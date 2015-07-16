#!/bin/sh

cd "WindowListGroup@jake.phy@gmail.com/locale"
for f in *.po
do
 filebase=$(basename "$f")
 filename="${filebase%.*}"
 cp "./mo/$filename.mo" "$HOME/.local/share/locale/$filename/LC_MESSAGES/WindowListGroup@jake.phy@gmail.com.mo"
 echo "Installed new languages file: $filename.mo to local."
done

