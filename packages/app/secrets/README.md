# Secrets Directory

This directory contains secret values that should not be committed to version control.

## Format

Each JSON file in this directory should follow this schema:

```json
{
  "secret-name": "secret-value",
  "another-secret": "another-value"
}
```

## Usage

In your configuration files (e.g., `agents.json`, `models.json`), you can reference secrets using the format:

```
{SECRET:secret-name}
```

For example:

```json
{
  "apiKey": "{SECRET:bluebubbles-api-key}"
}
```

When the configuration is loaded, the placeholder will be automatically replaced with the actual secret value from the JSON files in this directory.

## Notes

- All `.json` files in this directory will be loaded and merged together
- This directory is added to `.gitignore` and should never be committed
- If a secret is not found, a warning will be logged and the placeholder will remain unchanged
- The `example.json` file is provided as a template - copy it and update with your actual secrets
