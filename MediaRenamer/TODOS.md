# Media Renamer TODO List

## Core Features
- [ ] **Video Metadata Support**: 
  - Implement `IMetadataProvider` for video files (MP4, MOV, AVI)
  - Use ffmpeg (`ffprobe`) to extract creation time from video metadata
  - Add fallback logic when metadata is unavailable

- [ ] **Batch Processing**:
  - Add support for processing multiple folders recursively
  - Implement progress tracking and cancellation

## UI/UX Improvements
- [ ] **Drag-and-Drop Interface**: 
  - Enable drag-and-drop file selection in the main window
  - Visual feedback during file operations

- [ ] **Preview Mode**:
  - Show preview of renamed files before applying changes
  - Option to undo last operation

## Technical Improvements
- [ ] **Error Handling**:
  - Better error reporting for unsupported file types
  - Logging system for debugging purposes

- [ ] **Configuration System**:
  - Save/load renaming rules and preferences
  - Support for custom naming templates

## Testing
- [ ] **Unit Tests**:
  - Add unit tests for metadata extraction services
  - Test edge cases (corrupted files, missing metadata)

- [ ] **Integration Tests**:
  - Test complete file renaming workflows
  - Verify metadata preservation