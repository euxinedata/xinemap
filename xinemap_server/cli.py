import argparse
import threading
import webbrowser

import uvicorn


def main():
    parser = argparse.ArgumentParser(
        prog="xinemap",
        description="Data Vault 2.0 DBML diagram editor",
    )
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Start the diagram editor server")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--no-browser", action="store_true")

    args = parser.parse_args()

    if args.command != "serve":
        parser.print_help()
        return

    url = f"http://{args.host}:{args.port}"
    print(f"Serving XineMap at {url}")

    if not args.no_browser:
        threading.Timer(1.0, webbrowser.open, args=(url,)).start()

    uvicorn.run("xinemap_server.app:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
