import asyncio
import json
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SCRIPT = Path(__file__).resolve().parent / "mcp_weather_server.py"


async def main() -> None:
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(SCRIPT)],
        env={"PYTHONUNBUFFERED": "1"},
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            print("server:", init.serverInfo.name, init.serverInfo.version)
            tools = await session.list_tools()
            print("tools:", [tool.name for tool in tools.tools])
            result = await session.call_tool(
                "get_current_weather",
                {"latitude": 10.976, "longitude": 76.914, "timezone_name": "Asia/Kolkata"},
            )
            for block in result.content:
                print(json.dumps(json.loads(block.text), indent=2)[:900])


if __name__ == "__main__":
    asyncio.run(main())
