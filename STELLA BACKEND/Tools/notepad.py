"""
notepad.py — Windows Notepad & Document Automation Tools for OZEN/JARVIS

Provides safe, reliable document management, Notepad control, and text file operations
for LiveKit Agents. Features:
- Dynamic Desktop path detection (works across Windows setups, OneDrive, and EXEs).
- Native UTF-8 Unicode clipboard pasting for loss-free Hindi/Hinglish/English typing into Notepad.
- Overwrite protection safeguards to prevent accidental file deletion.
- Comprehensive path validation and error handling.
"""

from __future__ import annotations

import os
import sys
import logging
import asyncio
import subprocess
import ctypes

from livekit.agents import function_tool

try:
    import pyautogui
    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.1
    HAS_PYAUTOGUI = True
except ImportError:
    HAS_PYAUTOGUI = False
    logging.warning("pyautogui not installed — active Notepad pasting may be degraded.")


logger = logging.getLogger("notepad")

# ─── Dynamic Desktop Path Detection ──────────────────────────────────────────

def get_desktop_path() -> str:
    """Dynamically detect the Windows user's Desktop path.

    Supports registry lookup (User Shell Folders), OneDrive sync, environment variables,
    and standard user home directory fallback. Guaranteed to work on frozen EXEs and
    different user accounts.
    """
    # Method 1: Windows Registry User Shell Folders
    if sys.platform == "win32":
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders",
            )
            desktop_val, _ = winreg.QueryValueEx(key, "Desktop")
            winreg.CloseKey(key)
            # Expand environment variables like %USERPROFILE%
            expanded = os.path.expandvars(desktop_val)
            if os.path.isdir(expanded):
                return os.path.abspath(expanded)
        except Exception as exc:
            logger.debug("Registry desktop lookup failed: %s", exc)

    # Method 2: Standard user profile paths
    user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
    onedrive_desktop = os.path.join(user_profile, "OneDrive", "Desktop")
    standard_desktop = os.path.join(user_profile, "Desktop")

    if os.path.isdir(onedrive_desktop):
        return os.path.abspath(onedrive_desktop)
    if os.path.isdir(standard_desktop):
        return os.path.abspath(standard_desktop)

    # Fallback to standard Desktop path creation
    os.makedirs(standard_desktop, exist_ok=True)
    return os.path.abspath(standard_desktop)


def resolve_safe_path(filepath_or_name: str, default_folder: str = "") -> str:
    """Resolve and validate a file or folder path safely within the Desktop scope.

    Prevents unsafe path traversal attacks while allowing custom subfolders.
    """
    desktop = get_desktop_path()
    
    # Clean and strip input
    path_str = filepath_or_name.strip().strip('"').strip("'")
    
    # Determine base directory
    if default_folder:
        clean_folder = os.path.basename(default_folder.strip().strip('"').strip("'"))
        base_dir = os.path.join(desktop, clean_folder)
        os.makedirs(base_dir, exist_ok=True)
    else:
        base_dir = desktop

    # Check if absolute path was passed
    if os.path.isabs(path_str):
        resolved = os.path.abspath(path_str)
    else:
        resolved = os.path.abspath(os.path.join(base_dir, path_str))

    # Security check: Ensure resolved path resides within user profile / desktop hierarchy
    user_profile = os.path.abspath(os.environ.get("USERPROFILE", os.path.expanduser("~")))
    if not (resolved.startswith(desktop) or resolved.startswith(user_profile)):
        raise ValueError(f"Access denied: Path '{filepath_or_name}' is outside allowed directories.")

    return resolved


def _set_clipboard_unicode(text: str) -> bool:
    """Set system clipboard content natively on Windows using CF_UNICODETEXT.

    Supports full UTF-8 Unicode including Hindi, Hinglish, multi-line text, and code snippets.
    Does not require external third-party dependencies.
    """
    if sys.platform != "win32":
        return False
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        # Declare pointer-sized return types so this also works in 64-bit Python.
        user32.OpenClipboard.argtypes = [ctypes.c_void_p]
        user32.OpenClipboard.restype = ctypes.c_bool
        user32.EmptyClipboard.restype = ctypes.c_bool
        user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
        user32.SetClipboardData.restype = ctypes.c_void_p
        user32.CloseClipboard.restype = ctypes.c_bool
        kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
        kernel32.GlobalAlloc.restype = ctypes.c_void_p
        kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalLock.restype = ctypes.c_void_p
        kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalUnlock.restype = ctypes.c_bool

        if not user32.OpenClipboard(None):
            return False
        if not user32.EmptyClipboard():
            user32.CloseClipboard()
            return False

        # Encode as UTF-16 Little Endian with double null terminator for Windows API
        text_bytes = text.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-16le") + b"\x00\x00"
        h_mem = kernel32.GlobalAlloc(0x0042, len(text_bytes))  # GMEM_MOVEABLE | GMEM_ZEROINIT
        if not h_mem:
            user32.CloseClipboard()
            return False

        p_mem = kernel32.GlobalLock(h_mem)
        if not p_mem:
            user32.CloseClipboard()
            return False

        ctypes.memmove(p_mem, text_bytes, len(text_bytes))
        kernel32.GlobalUnlock(h_mem)
        if not user32.SetClipboardData(13, h_mem):  # CF_UNICODETEXT = 13
            kernel32.GlobalUnlock(h_mem)
            kernel32.GlobalFree(h_mem)
            user32.CloseClipboard()
            return False
        user32.CloseClipboard()
        return True
    except Exception as exc:
        logger.error("Native clipboard write failed: %s", exc)
        return False


def _focus_notepad_window() -> bool:
    """Bring the active Windows Notepad window to the foreground."""
    if sys.platform != "win32":
        return False
    try:
        user32 = ctypes.windll.user32
        # Find window by class name or title (Notepad class is 'Notepad' on Windows)
        hwnd = user32.FindWindowW("Notepad", None)
        if not hwnd:
            # Try Windows 11 modern Notepad title match
            hwnd = user32.FindWindowW(None, "Notepad")
        if hwnd:
            user32.ShowWindow(hwnd, 9)  # SW_RESTORE = 9
            user32.SetForegroundWindow(hwnd)
            return True
    except Exception as exc:
        logger.debug("Focus notepad window failed: %s", exc)
    return False


def _type_text_animated(text: str, interval: float = 0.005) -> None:
    """Type text quickly with visible keyboard animation while preserving Unicode."""
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    for line_number, line in enumerate(lines):
        ascii_text = "".join(character for character in line if ord(character) < 128)
        if ascii_text == line:
            if line:
                pyautogui.write(line, interval=interval)
        else:
            for character in line:
                if ord(character) < 128:
                    pyautogui.write(character, interval=interval)
                elif not _set_clipboard_unicode(character):
                    raise RuntimeError("Could not copy a Unicode character to the clipboard")
                else:
                    pyautogui.hotkey("ctrl", "v")
        if line_number < len(lines) - 1:
            pyautogui.press("enter")


# ─── LiveKit Function Tools ───────────────────────────────────────────────────

@function_tool()
async def open_notepad() -> str:
    """Open Windows Notepad application.

    Use this tool when the user says "Notepad kholo", "Open Notepad", "Launch Notepad", etc.
    """
    try:
        logger.info("Opening Windows Notepad...")
        await asyncio.to_thread(subprocess.Popen, ["notepad.exe"])
        await asyncio.sleep(0.8)
        _focus_notepad_window()
        return "✅ Windows Notepad has been opened, Sir."
    except Exception as exc:
        logger.error("Failed to open Notepad: %s", exc)
        return f"❌ Error opening Notepad: {exc}"


@function_tool()
async def write_notepad(text: str) -> str:
    """Write or paste text into the open Windows Notepad window.

    Supports Hindi, Hinglish, English, multi-line text, and code snippets.
    If Notepad is not currently open, it will launch Notepad first and then write.

    Args:
        text: The exact text content or code to write into Notepad.
    """
    if not text or not text.strip():
        return "⚠️ No text was provided to write into Notepad, Sir."

    try:
        # Step 1: Ensure Notepad is open and brought to front
        focused = await asyncio.to_thread(_focus_notepad_window)
        if not focused:
            # Launch Notepad if not active
            await asyncio.to_thread(subprocess.Popen, ["notepad.exe"])
            await asyncio.sleep(1.0)
            await asyncio.to_thread(_focus_notepad_window)

        # Step 2: Type visibly so every line appears as it is written.
        if HAS_PYAUTOGUI:
            await asyncio.sleep(0.3)
            await asyncio.to_thread(_type_text_animated, text)
            return f"✅ Animated typing completed ({len(text)} characters) in Notepad, Sir."

        # Keep a useful fallback when PyAutoGUI is unavailable.
        clipboard_ok = await asyncio.to_thread(_set_clipboard_unicode, text)
        if clipboard_ok:
            return "⚠️ Text copied to clipboard, but PyAutoGUI is unavailable to animate typing, Sir."
        return "❌ Unable to type or copy text because PyAutoGUI and the clipboard are unavailable, Sir."
    except Exception as exc:
        logger.error("Failed to write to Notepad: %s", exc)
        return f"❌ Error writing text to Notepad: {exc}"


@function_tool()
async def save_document(
    filename: str,
    content: str,
    folder_name: str = "",
    overwrite: bool = False,
) -> str:
    """Save content into a text document (.txt) on the Desktop.

    Safely creates text files using UTF-8 encoding. Protects existing files from being
    silently overwritten unless overwrite=True is explicitly passed.

    Args:
        filename: Name of the file (e.g. "notes", "code.txt", "Romeo.txt").
        content: Text content or code to write into the document.
        folder_name: Optional folder on Desktop to save in (e.g. "Jarvis").
        overwrite: Set to True ONLY if the user explicitly confirmed overwriting an existing file.
    """
    if not filename or not filename.strip():
        return "⚠️ Please provide a valid file name, Sir."

    clean_name = filename.strip()
    if not os.path.splitext(clean_name)[1]:
        clean_name += ".txt"

    try:
        target_path = resolve_safe_path(clean_name, default_folder=folder_name)

        # Overwrite safety check
        if os.path.exists(target_path) and not overwrite:
            rel_name = os.path.basename(target_path)
            return (
                f"⚠️ A file named '{rel_name}' already exists on Desktop, Sir. "
                f"Please confirm if you want to overwrite it by saying 'Overwrite {rel_name}', "
                f"or choose a different file name."
            )

        # Ensure parent directory exists
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        # Write text with UTF-8 encoding
        def _write_file():
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(content)

        await asyncio.to_thread(_write_file)

        # Verify file creation and read back size
        if os.path.exists(target_path):
            file_size = os.path.getsize(target_path)
            display_folder = folder_name if folder_name else "Desktop"
            return (
                f"✅ Document successfully saved as '{os.path.basename(target_path)}' "
                f"in '{display_folder}' ({len(content)} characters, {file_size} bytes), Sir."
            )
        else:
            return f"❌ Save verification failed: File was not created at '{clean_name}', Sir."

    except ValueError as val_err:
        return f"⚠️ Safety violation: {val_err}"
    except PermissionError:
        return f"❌ Permission denied: Unable to save to '{filename}'. File may be locked, Sir."
    except Exception as exc:
        logger.error("Failed to save document '%s': %s", filename, exc)
        return f"❌ Error saving document: {exc}"


@function_tool()
async def read_document(filepath: str) -> str:
    """Read and return the text content of an existing document from the Desktop.

    Args:
        filepath: File name or relative path on Desktop (e.g. "notes.txt", "Jarvis/code.py").
    """
    if not filepath or not filepath.strip():
        return "⚠️ Please specify which file to read, Sir."

    try:
        target_path = resolve_safe_path(filepath)

        if not os.path.exists(target_path):
            # Try appending .txt if missing
            if not os.path.splitext(target_path)[1]:
                alt_path = target_path + ".txt"
                if os.path.exists(alt_path):
                    target_path = alt_path

        if not os.path.exists(target_path):
            return f"❌ File '{filepath}' was not found on your Desktop, Sir."

        if not os.path.isfile(target_path):
            return f"⚠️ '{filepath}' is a directory, not a text file, Sir."

        # Read content using UTF-8 with fallback
        def _read_file():
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    return f.read()
            except UnicodeDecodeError:
                with open(target_path, "r", encoding="latin-1") as f:
                    return f.read()

        content = await asyncio.to_thread(_read_file)
        file_name = os.path.basename(target_path)

        if not content.strip():
            return f"📄 Document '{file_name}' is empty, Sir."

        # Truncate string for TTS responsiveness if content is huge
        if len(content) > 3000:
            truncated = content[:3000]
            return (
                f"📄 Document '{file_name}' content (showing first 3000 of {len(content)} characters):\n\n"
                f"{truncated}\n\n[... Remaining content omitted for brevity ...]"
            )

        return f"📄 Document '{file_name}' content:\n\n{content}"

    except ValueError as val_err:
        return f"⚠️ Safety violation: {val_err}"
    except PermissionError:
        return f"❌ Permission denied reading '{filepath}', Sir."
    except Exception as exc:
        logger.error("Failed to read document '%s': %s", filepath, exc)
        return f"❌ Error reading document: {exc}"


@function_tool()
async def append_to_document(filepath: str, text: str) -> str:
    """Append new text to an existing document on the Desktop.

    Args:
        filepath: File name or path on Desktop (e.g. "notes.txt").
        text: New text content to append.
    """
    if not filepath or not filepath.strip():
        return "⚠️ Please specify which document to modify, Sir."
    if not text or not text.strip():
        return "⚠️ No text was provided to append, Sir."

    try:
        target_path = resolve_safe_path(filepath)

        if not os.path.exists(target_path):
            if not os.path.splitext(target_path)[1]:
                alt_path = target_path + ".txt"
                if os.path.exists(alt_path):
                    target_path = alt_path

        if not os.path.exists(target_path):
            return f"❌ Document '{filepath}' does not exist on Desktop. Use save_document to create a new file, Sir."

        def _append_file():
            with open(target_path, "a", encoding="utf-8") as f:
                f.write("\n" + text)

        await asyncio.to_thread(_append_file)
        new_size = os.path.getsize(target_path)
        file_name = os.path.basename(target_path)
        return f"✅ New text appended to '{file_name}' successfully (total size: {new_size} bytes), Sir."

    except ValueError as val_err:
        return f"⚠️ Safety violation: {val_err}"
    except PermissionError:
        return f"❌ Permission denied modifying '{filepath}', Sir."
    except Exception as exc:
        logger.error("Failed to append to document '%s': %s", filepath, exc)
        return f"❌ Error appending to document: {exc}"


@function_tool()
async def create_desktop_folder(folder_name: str) -> str:
    """Create a new folder on the Desktop.

    Use this tool when the user says "Mere Desktop par Jarvis naam ka folder banao",
    "Create folder Project", etc.

    Args:
        folder_name: Name of the new folder to create.
    """
    if not folder_name or not folder_name.strip():
        return "⚠️ Please provide a valid folder name, Sir."

    try:
        clean_folder = os.path.basename(folder_name.strip().strip('"').strip("'"))
        desktop = get_desktop_path()
        target_folder = os.path.abspath(os.path.join(desktop, clean_folder))

        if os.path.exists(target_folder):
            return f"ℹ️ Folder '{clean_folder}' already exists on your Desktop, Sir."

        os.makedirs(target_folder, exist_ok=True)
        return f"✅ Folder '{clean_folder}' has been created on your Desktop, Sir."

    except Exception as exc:
        logger.error("Failed to create folder '%s': %s", folder_name, exc)
        return f"❌ Error creating folder: {exc}"


@function_tool()
async def open_document(filepath: str) -> str:
    """Open an existing text document from the Desktop in Windows Notepad or default editor.

    Args:
        filepath: Name or path of the file to open (e.g. "code.py", "notes.txt").
    """
    if not filepath or not filepath.strip():
        return "⚠️ Please specify which document to open, Sir."

    try:
        target_path = resolve_safe_path(filepath)

        if not os.path.exists(target_path):
            if not os.path.splitext(target_path)[1]:
                alt_path = target_path + ".txt"
                if os.path.exists(alt_path):
                    target_path = alt_path

        if not os.path.exists(target_path):
            return f"❌ File '{filepath}' was not found on your Desktop, Sir."

        # Launch file in default program / Notepad
        if sys.platform == "win32":
            await asyncio.to_thread(os.startfile, target_path)
        else:
            await asyncio.to_thread(subprocess.Popen, ["notepad.exe", target_path])

        file_name = os.path.basename(target_path)
        return f"✅ Document '{file_name}' has been opened, Sir."

    except ValueError as val_err:
        return f"⚠️ Safety violation: {val_err}"
    except Exception as exc:
        logger.error("Failed to open document '%s': %s", filepath, exc)
        return f"❌ Error opening document: {exc}"
