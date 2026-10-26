from __future__ import annotations

from datetime import datetime
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import AllocationRun, Household, Transaction
from ...schemas import ExecutionResultOut, ExecuteRequest, TransactionPageOut
from ...services.simulation import (
    DuplicateExecution,
    allocation_payload,
    execute_allocation_run,
    latest_run,
    transaction_payload,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=TransactionPageOut)
def list_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    household: str | None = None,
    status: str | None = None,
    q: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    sort_by: str = Query(default="executed_at"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
) -> dict:  # type: ignore[type-arg]
    conditions = []
    if household:
        conditions.append(or_(Transaction.seller_id == household, Transaction.buyer_id == household))
    if status:
        conditions.append(Transaction.status == status)
    if q:
        term = f"%{q.strip()}%"
        matching_ids = [
            row for row in db.scalars(select(Household.id).where(Household.name.ilike(term))).all()
        ]
        search_parts = [
            Transaction.seller_id.ilike(term),
            Transaction.buyer_id.ilike(term),
            cast(Transaction.id, String).ilike(term),
        ]
        if matching_ids:
            search_parts.extend(
                [
                    Transaction.seller_id.in_(matching_ids),
                    Transaction.buyer_id.in_(matching_ids),
                ]
            )
        conditions.append(or_(*search_parts))
    if from_date:
        conditions.append(Transaction.executed_at >= from_date)
    if to_date:
        conditions.append(Transaction.executed_at <= to_date)

    sort_columns = {
        "executed_at": Transaction.executed_at,
        "energy_kwh": Transaction.energy_kwh,
        "price_inr_kwh": Transaction.price_inr_kwh,
        "power_kw": Transaction.power_kw,
        "id": Transaction.id,
        "total_value_inr": Transaction.total_value_inr,
    }
    column = sort_columns.get(sort_by)
    if column is None:
        raise HTTPException(status_code=422, detail=f"Unsupported sort_by value: {sort_by}")
    order = column.asc() if sort_dir == "asc" else column.desc()

    total = db.scalar(select(func.count()).select_from(Transaction).where(*conditions)) or 0
    rows = db.scalars(
        select(Transaction)
        .where(*conditions)
        .order_by(order, Transaction.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    return {
        "items": [transaction_payload(transaction, names) for transaction in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


@router.get("/{transaction_id}", response_model=dict)
def transaction_detail(transaction_id: int, db: Session = Depends(get_db)) -> dict:  # type: ignore[type-arg]
    transaction = db.get(Transaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail=f"Transaction {transaction_id} not found")
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    payload = transaction_payload(transaction, names)
    payload.update(
        {
            "allocated_power_kw": transaction.power_kw,
            "energy_formula": (
                f"{transaction.power_kw:.4f} kW × {transaction.interval_seconds} s ÷ 3600 = "
                f"{transaction.energy_kwh:.4f} kWh"
            ),
            "settlement": "Simulated only. No payment or financial transfer occurred.",
        }
    )
    return payload


@router.post("/execute", response_model=ExecutionResultOut)
async def execute_transactions(
    payload: ExecuteRequest, db: Session = Depends(get_db)
) -> dict:  # type: ignore[type-arg]
    from ...services.realtime import hub

    run = latest_run(db) if payload.run_id is None else db.get(AllocationRun, payload.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="No allocation proposal exists")
    try:
        created = execute_allocation_run(db, run.id)
    except DuplicateExecution as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.refresh(run)
    names = {household.id: household.name for household in db.scalars(select(Household)).all()}
    allocation = allocation_payload(db, run)
    await hub.broadcast(
        {
            "type": "transaction.created",
            "seq": run.tick,
            "data": {"run_id": run.id, "count": len(created)},
        }
    )
    return {
        "allocation": allocation,
        "transactions": [transaction_payload(transaction, names) for transaction in created],
        "message": f"Executed {len(created)} simulated transaction(s). No financial settlement occurred.",
    }
