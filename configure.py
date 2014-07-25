#!/usr/bin/env python2.7

import os
from gi.repository import Gtk

def FinishMessage():
    dialog = Gtk.MessageDialog(None, 0, Gtk.MessageType.INFO,Gtk.ButtonsType.NONE, "Thanks For using this Applet")
    dialog.format_secondary_text("Your Action has Completed Successfully")
    return dialog

class NewLabel(Gtk.Label):
    def __init__(self, label, tooltip=None):
        super(NewLabel, self).__init__(label)
	NewTooltip(self, tooltip)

class NewTooltip(Gtk.HBox):
    def __init__(self, item, text):
        self.text = text
        super(NewTooltip, self).__init__()
	if self.text:
            item.set_has_tooltip(True)
  	    item.connect('query-tooltip', self.tooltip)

    def tooltip(self, item, x, y, key_mode, tooltip):
        tooltip.set_text(self.text)
        return True

class GTKButton(Gtk.HBox):
    def __init__(self, button, label, command, tooltip=None):
        self.command = command
        super(GTKButton, self).__init__()
        self.label = NewLabel(label, tooltip)
        self.button = Gtk.Button(button, None, False)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        if (button != ""):
            self.pack_end(self.button, False, False, 2)
        self.button.connect('clicked', self.on_clicked)
        NewTooltip(self.button, tooltip)

    def on_clicked(self, signal):
        os.system(self.command)
        self.dialog = FinishMessage()
        self.dialog.run()

class CinnamonListSettings:

    def __init__(self):
        self.window = Gtk.Window(title='Window List Settings')
        self.window.connect('destroy', Gtk.main_quit)
	self.window.set_default_size(320, 50)
	self.window.set_border_width(5)
	self.window.set_position(Gtk.WindowPosition.CENTER)

	self.NoteBK = Gtk.Notebook()

        self.copy_applet = "cp -avrf  WindowListGroup@jake.phy@gmail.com ~/.local/share/cinnamon/applets/"
        self.remove_applet = "rm -rf -v ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com"

        self.install_applet = GTKButton('Install Applet', 'Install the Applet',self.copy_applet, "Install the applet and schema")
        self.uninstall_applet = GTKButton('Uninstall Applet', 'Uninstall the Applet', self.remove_applet, "Remove the applet and schema")

        self.Ivbox = Gtk.VBox()
        self.Ivbox.add(self.install_applet)
        self.Ivbox.add(self.uninstall_applet)
	self.NoteBK.append_page(self.Ivbox, Gtk.Label("Installation"))

        self.window.add(self.NoteBK)
        self.window.show_all()

def main():
    CinnamonListSettings()
    Gtk.main()

if __name__ == '__main__':
    main()
