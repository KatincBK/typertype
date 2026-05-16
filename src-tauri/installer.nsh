; Typertype NSIS installer hooks
;
; Registers Typertype under HKLM\SOFTWARE\RegisteredApplications so it appears
; in Windows 11 "Default Apps" and "Choose default apps by file type". The
; default Tauri NSIS template writes ProgID entries (HKCR) but not the
; Capabilities/RegisteredApplications tree that the Default Apps UI scans.

!macro NSIS_HOOK_POSTINSTALL
  ; Application Capabilities — describes Typertype and its supported file types.
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities" "ApplicationName" "Typertype"
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities" "ApplicationDescription" "Typora-benzeri acik kaynak Markdown editoru / Typora-like open-source Markdown editor"
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities" "ApplicationIcon" "$INSTDIR\Typertype.exe,0"

  ; File associations point at the ProgIDs that the Tauri template already wrote
  ; under HKLM\SOFTWARE\Classes (association.name from tauri.conf.json).
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities\FileAssociations" ".md" "Markdown Document"
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities\FileAssociations" ".markdown" "Markdown Document"
  WriteRegStr HKLM "SOFTWARE\Typertype\Capabilities\FileAssociations" ".txt" "Text Document"

  ; Register the capabilities subkey so Default Apps picks Typertype up.
  WriteRegStr HKLM "SOFTWARE\RegisteredApplications" "Typertype" "SOFTWARE\Typertype\Capabilities"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKLM "SOFTWARE\RegisteredApplications" "Typertype"
  DeleteRegKey HKLM "SOFTWARE\Typertype\Capabilities\FileAssociations"
  DeleteRegKey HKLM "SOFTWARE\Typertype\Capabilities"
  DeleteRegKey /ifempty HKLM "SOFTWARE\Typertype"
!macroend
