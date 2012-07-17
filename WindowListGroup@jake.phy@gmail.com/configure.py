#!/usr/bin/env python2.7

from os import system
from gi.repository import Gtk, Gio, Gdk

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
        system(self.command)

class CinnamonListSettings:
    def __init__(self):
        self.window = Gtk.Window(title='Window List Settings v2.6.9-2')
        self.window.connect('destroy', Gtk.main_quit)
        self.window.set_border_width(5)
        self.window.set_position(Gtk.WindowPosition.CENTER)
        self.window.resize(400,100)

        self.action_completed = "echo 'Action Completed'"
        self.compile_schema =  "gksu 'glib-compile-schemas /usr/share/glib-2.0/schemas/'"
        self.copy_applet = "mkdir -p ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com && cp -f -v metadata.json applet.js cinnamon-window-list-settings.py icon.png specialButtons.js specialMenus.js ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com"
        self.copy_schema = "gksu 'cp -f -v org.cinnamon.applets.windowListGroup.gschema.xml /usr/share/glib-2.0/schemas/'"
        self.remove_applet = "rm -rf -v ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com"
        self.remove_schema = "gksu 'rm -v /usr/share/glib-2.0/schemas/org.cinnamon.applets.windowListGroup.gschema.xml'"
        self.reset_schema = "gsettings reset-recursively  org.cinnamon.applets.windowListGroup"
        self.restart_cinnamon = "nohup cinnamon --replace > /dev/null 2>&1 &"

        self.install_applet = GTKButton('Install Applet', 'Install the Applet', self.copy_schema + " && " + self.compile_schema + " && " + self.copy_applet + " && " + self.action_completed, "Install the applet and schema")
        self.uninstall_applet = GTKButton('Uninstall Applet', 'Uninstall the Applet', self.remove_applet + " && " + self.reset_schema + " && " + self.remove_schema + " && " + self.compile_schema + " && " + self.action_completed, "Remove the applet and schema")
        self.restart_cinnamon = GTKButton("Restart Cinnamon", 'Restart Cinnamon', self.restart_cinnamon, "Restart Cinnamon for applet to work")

        #panel1:left:1:WindowListGroup@jake.phy@gmail.com

        self.vbox = Gtk.VBox();
        self.vbox.add(self.install_applet)
        self.vbox.add(self.uninstall_applet)
        self.vbox.add(self.restart_cinnamon)
        self.vbox.show_all()
        self.window.add(self.vbox)
        self.window.show_all()

def main():
    CinnamonListSettings()
    Gtk.main()

if __name__ == '__main__':
    main()