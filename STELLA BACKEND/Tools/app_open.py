import logging
import asyncio
import subprocess
from livekit.agents import function_tool
import os
import shutil

try:
    import pyautogui

    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
    HAS_PYAUTOGUI = True
except ImportError:
    pyautogui = None
    HAS_PYAUTOGUI = False

@function_tool()
async def open_app(app_name: str, browser: str = "") -> str:
    """
    Opens Windows applications or websites.

    Args:
        app_name: Application or website to open.
        browser: Optional browser to use for websites.
                 Example: chrome, edge, firefox.
    """

    try:
        app = app_name.strip().lower()
        browser = browser.strip().lower()

        logging.info(
            f"🚀 Opening app='{app}', browser='{browser}'"
        )

        # =========================================================
        # WEBSITES
        # =========================================================

        websites = {
            "youtube": "https://www.youtube.com",
            "google": "https://www.google.com",
            "gmail": "https://mail.google.com",
            "github": "https://github.com",
            "chatgpt": "https://chatgpt.com",
            "instagram": "https://www.instagram.com",
            "facebook": "https://www.facebook.com",
            "whatsapp": "https://web.whatsapp.com",
        }

        if app in websites:

            url = websites[app]

            # -----------------------------------------------------
            # OPEN WEBSITE IN SPECIFIC BROWSER
            # -----------------------------------------------------

            browser_map = {
                "chrome": "chrome.exe",
                "google chrome": "chrome.exe",

                "edge": "msedge.exe",
                "microsoft edge": "msedge.exe",

                "firefox": "firefox.exe",
            }

            if browser in browser_map:

                browser_exe = browser_map[browser]

                logging.info(
                    f"🌐 Opening {url} using {browser_exe}"
                )

                subprocess.Popen(
                    [
                        browser_exe,
                        url
                    ],
                    shell=False
                )

                await asyncio.sleep(1)

                return (
                    f"✅ Opening {app_name} in "
                    f"{browser.title()}, Sir."
                )

            # -----------------------------------------------------
            # NO BROWSER SPECIFIED
            # USE WINDOWS DEFAULT BROWSER
            # -----------------------------------------------------

            subprocess.Popen(
                [
                    "cmd",
                    "/c",
                    "start",
                    "",
                    url
                ],
                shell=False
            )

            return f"✅ Opening {app_name}, Sir."

        # =========================================================
        # NORMAL APPLICATIONS
        # =========================================================

        app_map = {
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "calc": "calc.exe",
            "paint": "mspaint.exe",

            "chrome": "chrome.exe",
            "google chrome": "chrome.exe",

            "edge": "msedge.exe",
            "microsoft edge": "msedge.exe",

            "firefox": "firefox.exe",

            "word": "winword.exe",
            "excel": "excel.exe",
            "powerpoint": "powerpnt.exe",

            "vscode": "code.exe",
            "vs code": "code.exe",
        }

        executable = app_map.get(app)

        if executable:

            logging.info(
                f"🚀 Launching application: {executable}"
            )

            subprocess.Popen(
                executable,
                shell=True
            )

            await asyncio.sleep(1)

            return f"✅ '{app_name}' has been opened, Sir."

        # =========================================================
        # FALLBACK
        # =========================================================

        subprocess.Popen(
            f'start "" "{app_name}"',
            shell=True
        )

        await asyncio.sleep(1)

        return f"✅ Attempted to open '{app_name}', Sir."

    except Exception as e:

        logging.exception(
            f"❌ Error opening {app_name}"
        )

        return (
            f"❌ Could not open '{app_name}': {str(e)}"
        )
        
@function_tool()
async def close_app(app_name: str = None) -> str:
    """
    Closes an application. If app_name is provided, attempts to kill that process.
    Otherwise, closes the currently active window.
    
    Args:
        app_name: Optional name of the application to close.
    """
    try:
        if app_name:
            logging.info(f"Closing application by name: {app_name}")
            # Try to close by name using taskkill
            cmd = f'taskkill /F /IM "{app_name}.exe" /T'
            result = await asyncio.to_thread(subprocess.run, cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode == 0:
                return f"✅ Application '{app_name}' has been closed, Sir."
            else:
                # Try without .exe
                cmd_no_exe = f'taskkill /F /IM "{app_name}" /T'
                result_no_exe = await asyncio.to_thread(subprocess.run, cmd_no_exe, shell=True, capture_output=True, text=True)
                if result_no_exe.returncode == 0:
                    return f"✅ Application '{app_name}' has been closed, Sir."
                
                logging.warning(f"Taskkill failed for {app_name}, falling back to Alt+F4")

        # Fallback to Alt+F4 for the active window
        if not HAS_PYAUTOGUI:
            return "PyAutoGUI is not installed, so I cannot control the active window yet."
        logging.info("Closing active window via Alt+F4")
        await asyncio.to_thread(pyautogui.hotkey, 'alt', 'f4')
        return "✅ Closing the active application/window, Sir."
        
    except Exception as e:
        logging.error(f"Error closing application: {e}")
        return f"❌ Unable to close the application: {str(e)}"

@function_tool()
async def manage_window(action: str) -> str:
    """
    Manages the active window (minimize, maximize, close).
    
    Args:
        action: 'minimize', 'maximize', or 'close'
    """
    try:
        action = action.lower().strip()
        if not HAS_PYAUTOGUI:
            return "PyAutoGUI is not installed, so window controls are unavailable."
        if action == "minimize":
            await asyncio.to_thread(pyautogui.hotkey, 'win', 'down')
            return "✅ Window minimized, Sir."
        elif action == "maximize":
            await asyncio.to_thread(pyautogui.hotkey, 'win', 'up')
            return "✅ Window maximized, Sir."
        elif action in ["close", "exit", "quit"]:
            await asyncio.to_thread(pyautogui.hotkey, 'alt', 'f4')
            return "✅ Window closed, Sir."
        else:
            return f"⚠️ Action '{action}' is not recognized, Sir."
    except Exception as e:
        logging.error(f"Error managing window: {e}")
        return f"❌ Error during {action}: {str(e)}"
