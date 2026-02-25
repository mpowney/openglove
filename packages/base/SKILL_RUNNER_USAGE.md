# Skill Runner Dynamic Loading

BaseSkill now supports dynamically loading skill runners from configuration files.

## Configuration

Add a `runner` or `skillRunner` property to your skill configuration in `skills.json`:

### Simple String Format
```json
{
  "MySkill": {
    "runner": "RinseAndRepeatRunner"
  }
}
```

### Object Format (with options)
```json
{
  "MySkill": {
    "runner": {
      "type": "RinseAndRepeatRunner",
      "opts": {
        "customOption": "value"
      }
    }
  }
}
```

### Custom Import Path
```json
{
  "MySkill": {
    "runner": {
      "type": "RinseAndRepeatRunner",
      "importPath": "../../app/src/runners",
      "opts": {}
    }
  }
}
```

## Environment Variables

- `SKILL_RUNNERS_PATH`: Override the default import path for all skill runners (default: `../runners`)

## Example

Given this configuration in `skills.json`:
```json
{
  "TimeSkill": {
    "runner": {
      "type": "RinseAndRepeatRunner",
      "opts": {
        "maxRetries": 3
      }
    }
  }
}
```

When `TimeSkill` is instantiated, it will:
1. Detect the runner configuration
2. Dynamically import from `../runners/RinseAndRepeatRunner`
3. Instantiate the runner with the provided options
4. Set it as the skill's runner

The runner will then be called automatically before and after the skill executes via the `executeWithRunner` method.

## Notes

- The dynamic import happens asynchronously, so the runner may not be available immediately after skill construction
- If the import fails, a warning is logged but the skill will still function without the runner
- The import uses `/* webpackIgnore: true */` to allow runtime path resolution
