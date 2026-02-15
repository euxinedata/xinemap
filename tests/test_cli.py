from unittest.mock import patch

from xinemap_server.cli import main


def test_default_args():
    """Default args: host=127.0.0.1, port=8000, browser enabled."""
    with patch("xinemap_server.cli.uvicorn.run") as mock_run, \
         patch("xinemap_server.cli.webbrowser.open"), \
         patch("sys.argv", ["xinemap", "serve"]):
        main()
        mock_run.assert_called_once_with(
            "xinemap_server.app:app", host="127.0.0.1", port=8000
        )


def test_custom_host_port():
    with patch("xinemap_server.cli.uvicorn.run") as mock_run, \
         patch("xinemap_server.cli.webbrowser.open"), \
         patch("sys.argv", ["xinemap", "serve", "--host", "0.0.0.0", "--port", "3000"]):
        main()
        mock_run.assert_called_once_with(
            "xinemap_server.app:app", host="0.0.0.0", port=3000
        )


def test_no_browser():
    with patch("xinemap_server.cli.uvicorn.run"), \
         patch("xinemap_server.cli.threading.Timer") as mock_timer, \
         patch("sys.argv", ["xinemap", "serve", "--no-browser"]):
        main()
        mock_timer.assert_not_called()


def test_no_command_prints_help(capsys):
    """Running without a subcommand prints help."""
    with patch("sys.argv", ["xinemap"]):
        main()
    captured = capsys.readouterr()
    assert "serve" in captured.out
