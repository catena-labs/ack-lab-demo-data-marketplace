{ pkgs }: {
  deps = [
    # Prefer the newest Node available on your channel.
    # Try 22 first; if your channel doesn't have it, switch to 20.
    pkgs.nodejs-22_x

    # pnpm CLI
    pkgs.nodePackages.pnpm
  ];
}