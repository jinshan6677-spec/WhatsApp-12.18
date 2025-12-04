# Migration System

This directory contains the migration system for transitioning from the old multi-window architecture to the new single-window architecture.

## Components

### MigrationManager.js
Core migration logic that handles:
- Detection of old configuration
- Backup creation
- Configuration migration
- Session data migration
- Validation

### MigrationDialog.js
UI management for the migration process:
- Creates and manages the migration dialog window
- Sends progress updates to the renderer
- Handles IPC communication
- Coordinates with MigrationManager

## Usage

### Basic Usage

```javascript
const MigrationManager = require('./MigrationManager');
const MigrationDialog = require('./MigrationDialog');

// Create instances
const migrationManager = new MigrationManager();
const migrationDialog = new MigrationDialog();

// Check if migration is needed
const detection = await migrationManager.detectMigrationNeeded();

if (detection.needed) {
  // Show migration UI
  await migrationDialog.show(migrationManager);
  
  // The dialog will handle the migration process
  // and close when the user clicks "Continue"
}
```

### Advanced Usage with Callbacks

```javascript
const migrationDialog = new MigrationDialog({
  width: 700,
  height: 600,
  parent: mainWindow  // Optional parent window
});

await migrationDialog.show(migrationManager);

// Listen for dialog close
migrationDialog.window.on('closed', () => {
  console.log('Migration complete, continuing to app');
  createMainWindow();
});
```

## Migration Flow

```
1. Detection Screen
   ↓
   User clicks "Start Migration"
   ↓
2. Progress Screen
   ├─ Detect and backup (0-20%)
   ├─ Migrate configuration (20-60%)
   ├─ Migrate session data (60-80%)
   ├─ Save configuration (80-90%)
   └─ Complete (90-100%)
   ↓
3. Results Screen
   ├─ Show summary
   ├─ List migrated accounts
   ├─ Display errors/warnings
   └─ Show backup location
   ↓
   User clicks "Continue to App"
```

## IPC Events

### From Main to Renderer

- `migration:progress` - Progress updates (0-100%)
- `migration:log` - Log entries (info, success, warning, error)
- `migration:complete` - Migration completed successfully
- `migration:error` - Migration failed

### From Renderer to Main

- `migration:start` - Start the migration process
- `migration:cancel` - Cancel and close dialog
- `migration:continue` - Continue to app after migration
- `migration:open-backup` - Open backup file location

## Testing

Run the test script to see the migration UI in action:

```bash
node scripts/test-migration-ui.js
```

This will:
1. Create a test window
2. Show the migration dialog
3. Allow you to test the UI interactively

## Error Handling

The migration system handles errors gracefully:

1. **Backup Failure**: Shows error, allows retry
2. **Partial Migration**: Shows what succeeded
3. **Session Data Issues**: Warns but continues
4. **Validation Errors**: Lists specific problems

All errors are displayed in the UI with clear messages and recovery options.

## Documentation

See the following documents for more details:

- [Migration UI Quick Reference](../../../docs/MIGRATION_UI_QUICK_REFERENCE.md)
- [Migration Detection Quick Reference](../../../docs/MIGRATION_DETECTION_QUICK_REFERENCE.md)
- [Configuration Migration Quick Reference](../../../docs/CONFIGURATION_MIGRATION_QUICK_REFERENCE.md)
- [Session Data Migration Quick Reference](../../../docs/SESSION_DATA_MIGRATION_QUICK_REFERENCE.md)
- [Task 24 Implementation Summary](../../../docs/TASK_24_IMPLEMENTATION_SUMMARY.md)

