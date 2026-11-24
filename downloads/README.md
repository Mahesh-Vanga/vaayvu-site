# Download artifacts

Files in this folder are served at `/downloads/` and git-ignored. Copy the
current release from the project root:

```sh
bash website/sync-downloads.sh <version>
```

Example:

```sh
bash website/sync-downloads.sh 0.0.23
```

The page shows “Not uploaded yet” for any artifact that is missing, so a deploy
without files is honest rather than broken.
