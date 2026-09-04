# Movie Night Wheel

A private, browser-based movie wheel designed for Unraid. People, colours, suggestions, attendance, and winner history are saved in `/data/movie-night.json`.

## Run on Unraid

Build the image from this folder, expose container port `3000` as host port `8090`, and map `/mnt/user/appdata/movie-night-wheel` to `/data`.

With Docker Compose:

```sh
docker compose up -d --build
```

Then open `http://YOUR-UNRAID-IP:8090`.

## GitHub container publishing

Every push to the `main` branch automatically builds and publishes an Unraid-ready image to GitHub Container Registry. The image address is `ghcr.io/its-goose/movie-night-wheel:latest`.
