from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import google, noise_cancellation
from prompt import AGENT_INSTRUCTION, SESSION_INSTRUCTION, TOOLS_INSTRUCTION

load_dotenv(".env")

from Tools.app_open import close_app, manage_window, open_app
from Tools.notepad import (
    open_notepad,
    write_notepad,
    save_document,
    read_document,
    append_to_document,
    create_desktop_folder,
    open_document,
)


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=f"{AGENT_INSTRUCTION}\n{TOOLS_INSTRUCTION}",
            tools=[
                   close_app,      #this tool for Application open and close
                   manage_window,  #this tool for Application open and close
                   open_app,       #this tool for Application open and close
                   open_notepad,   
                   write_notepad,
                   save_document,
                   read_document,
                   append_to_document,
                   create_desktop_folder,
                   open_document, 
                   ],
        )

server = AgentServer()

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-3.1-flash-live-preview",
            voice="Sulafat",
            temperature=0.8,
            instructions=AGENT_INSTRUCTION,
        )
    )
    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.NC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions=SESSION_INSTRUCTION,
    )


if __name__ == "__main__":
    agents.cli.run_app(server)