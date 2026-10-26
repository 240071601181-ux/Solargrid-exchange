import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sellerApi } from "../api/sellerApi";
import { buyerApi } from "../api/buyerApi";
import { queryKeys } from "../api/queryKeys";
import type { OfferCreate, OfferUpdate, ProfilePatch, PurchaseCreate } from "../types/api";

export function useSellerMutations() {
  const queryClient = useQueryClient();

  const invalidateOffers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerOffers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerDashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerAvailability }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerSales }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sellerEarnings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.market }),
    ]);

  const createOffer = useMutation({
    mutationFn: (payload: OfferCreate) => sellerApi.createOffer(payload),
    onSuccess: invalidateOffers,
  });
  const updateOffer = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: OfferUpdate }) => sellerApi.updateOffer(id, payload),
    onSuccess: invalidateOffers,
  });
  const pauseOffer = useMutation({
    mutationFn: (id: number) => sellerApi.pauseOffer(id),
    onSuccess: invalidateOffers,
  });
  const resumeOffer = useMutation({
    mutationFn: (id: number) => sellerApi.resumeOffer(id),
    onSuccess: invalidateOffers,
  });
  const cancelOffer = useMutation({
    mutationFn: (id: number) => sellerApi.cancelOffer(id),
    onSuccess: invalidateOffers,
  });
  const updateProfile = useMutation({
    mutationFn: (payload: ProfilePatch) => sellerApi.updateProfile(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerProfile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerDashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerSolar });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sellerAvailability });
    },
  });

  return { createOffer, updateOffer, pauseOffer, resumeOffer, cancelOffer, updateProfile };
}

export function useBuyerMutations() {
  const queryClient = useQueryClient();

  const invalidatePurchases = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.buyerDashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.buyerPurchases }),
      queryClient.invalidateQueries({ queryKey: queryKeys.buyerSpending }),
      queryClient.invalidateQueries({ queryKey: queryKeys.buyerUsage }),
      queryClient.invalidateQueries({ queryKey: queryKeys.market }),
    ]);

  const purchase = useMutation({
    mutationFn: (payload: PurchaseCreate) => buyerApi.createPurchase(payload),
    onSuccess: invalidatePurchases,
  });
  const updateProfile = useMutation({
    mutationFn: (payload: ProfilePatch) => buyerApi.updateProfile(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.buyerProfile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.buyerDashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.buyerUsage });
    },
  });

  return { purchase, updateProfile };
}
