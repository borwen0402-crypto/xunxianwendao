@echo off
echo Cleaning up unnecessary files for internal testing release...

:: Remove directories
if exist ".plan" rmdir /s /q ".plan"
if exist ".trae" rmdir /s /q ".trae"
if exist ".vercel" rmdir /s /q ".vercel"
if exist "replay_specs" rmdir /s /q "replay_specs"

:: Remove files
if exist ".vercelignore" del /q ".vercelignore"
if exist "pack_release.ps1" del /q "pack_release.ps1"
if exist "package.py" del /q "package.py"
if exist "repro_exp.js" del /q "repro_exp.js"
if exist "repro_test8.js" del /q "repro_test8.js"
if exist "test_regression_specs.html" del /q "test_regression_specs.html"
if exist "verify_combat_simulator.html" del /q "verify_combat_simulator.html"
if exist "verify_pluggability.html" del /q "verify_pluggability.html"
if exist "js\combat_engine_v2.js" del /q "js\combat_engine_v2.js"
if exist "INTERNAL_ALPHA_README.md" del /q "INTERNAL_ALPHA_README.md"

:: Optional: Remove the verification file we are currently using (uncomment when ready)
:: if exist "verify_combat_interfaces.html" del /q "verify_combat_interfaces.html"

echo Cleanup complete!
pause