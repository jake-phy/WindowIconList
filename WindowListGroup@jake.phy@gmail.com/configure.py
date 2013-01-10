#!/usr/bin/env python2.7

import os
from gi.repository import Gtk, Gio, Gdk

def Settings(schema):
    path = os.path.expanduser("~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com/schemas/")
    if os.path.isfile(path + "gschemas.compiled") == True:
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(path, None, False)
        lookupSchema = schemaSource.lookup(schema, False)
	compiledSchema = Gio.Settings.new_full(lookupSchema, None, None)
	return compiledSchema
    else:
	return "no Schema"

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

class GSettingsCheckButton(Gtk.HBox):
    def __init__(self, label, schema, key, tooltip=None):
        self.key = key
        super(GSettingsCheckButton, self).__init__()
        self.label = Gtk.Label(label)
	self.button = Gtk.CheckButton()
	self.label = NewLabel(label, tooltip)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.button, False, False, 2)
        self.settings = Settings(schema)
        self.button.set_active(self.settings.get_boolean(self.key))
        self.button.connect('toggled', self.on_my_value_changed)
	NewTooltip(self.button, tooltip)
        
    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.button.get_active())

class GSettingsSpinButton(Gtk.HBox):
    def __init__(self, label, schema, key, min, max, step, page, tooltip=None):
        self.key = key
        super(GSettingsSpinButton, self).__init__()
        self.label = Gtk.Label(label)
        self.settings = Settings(schema)
	self.adjustment = Gtk.Adjustment(self.settings.get_int(self.key), min, max, step, page, 0)
        self.spinner = Gtk.SpinButton()
	self.label = NewLabel(label, tooltip)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.spinner, False, False, 2)

        self.spinner.set_adjustment(self.adjustment)
        self.spinner.connect('value-changed', self.on_my_value_changed)
	NewTooltip(self.spinner, tooltip)
        
    def on_my_value_changed(self, widget):
        self.settings.set_int(self.key, widget.get_value())

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

class GSettingsComboBox(Gtk.HBox):
    def __init__(self, label, schema, key, items, tooltip=None):
        self.key = key
	self.items = items
        super(GSettingsComboBox, self).__init__()
        self.label = Gtk.Label(label)
	self.combo = Gtk.ComboBoxText()
	self.label = NewLabel(label, tooltip)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.combo, False, False, 2)

        self.combo.connect('changed', self.on_my_value_changed)
        self.buttonFirst = None
        self.settings = Settings(schema)
        self.active = self.settings.get_enum(self.key)
        for (idx,item) in self.items:
	    self.combo.append_text(item)
	    if (self.active == idx):
		self.combo.set_active(idx)
	    NewTooltip(self.combo, tooltip)

    def on_my_value_changed(self, widget):
            self.settings.set_enum(self.key, widget.get_active())

class CinnamonListSettings:

    def __init__(self):
        self.window = Gtk.Window(title='Window List Settings')
        self.window.connect('destroy', Gtk.main_quit)
	self.window.set_default_size(320, 50)
	self.window.set_border_width(5)
	self.window.set_position(Gtk.WindowPosition.CENTER)

	self.NoteBK = Gtk.Notebook()

        self.action_completed = "echo 'Action Completed'"
        self.compile_schema =  "glib-compile-schemas ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com/schemas"
        self.copy_applet = "mkdir -p ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com && cp -f -v  convenience.js metadata.json applet.js configure.py icon.png specialButtons.js specialMenus.js ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com"
        self.copy_schema = "mkdir -p ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com/schemas && cp -f -v  org.cinnamon.applets.windowListGroup.gschema.xml ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com/schemas"
        #self.copy_schema = "gksu 'cp -f -v org.cinnamon.applets.windowListGroup.gschema.xml /usr/share/glib-2.0/schemas/'"
        self.remove_applet = "rm -rf -v ~/.local/share/cinnamon/applets/WindowListGroup@jake.phy@gmail.com"
        self.restart_cinnamon = "nohup cinnamon --replace > /dev/null 2>&1 &"

	self.installation = NewLabel('Installation')
        self.install_applet = GTKButton('Install Applet', 'Install the Applet', self.copy_schema + "&&" + self.compile_schema + " && " + self.copy_applet + " && " + self.action_completed, "Install the applet and schema")
        self.uninstall_applet = GTKButton('Uninstall Applet', 'Uninstall the Applet', self.remove_applet + " && " + self.action_completed, "Remove the applet and schema")
        self.restart_cinnamon = GTKButton("Restart Cinnamon", 'Restart Cinnamon', self.restart_cinnamon, "Restart Cinnamon for applet to work")

        self.Ivbox = Gtk.VBox()
        self.Ivbox.add(self.installation)
        self.Ivbox.add(self.install_applet)
        self.Ivbox.add(self.uninstall_applet)
        self.Ivbox.add(self.restart_cinnamon)
	self.NoteBK.append_page(self.Ivbox, Gtk.Label("Install"))

	if Settings("org.cinnamon.applets.windowListGroup") != "no Schema":
	    self.window_list_settings = NewLabel('WINDOW LIST SETTINGS')
	    self.list_title_display = GSettingsComboBox('Window Title Display', "org.cinnamon.applets.windowListGroup", 'title-display', [(0, 'none'), (1, 'app'), (2, 'title'), (3, 'focused')], "title: display the window title, app: diplay app name, none: don't display anything")
            self.list_group_apps = GSettingsCheckButton("Group Apps into one Icon", "org.cinnamon.applets.windowListGroup", "group-apps", "Checked: group windows into one app icon, else: every window has it's own icon")
            self.seperate_favorites = GSettingsComboBox('Favorites Display', "org.cinnamon.applets.windowListGroup", 'favorites-display', [(0, 'favorites'), (1, 'pinned'), (2, 'none')], "favorites: display the favorites, pinned: display pinned apps instead of favorites, none: don't display anything")
	    self.list_number_display = GSettingsComboBox('List Number Display', "org.cinnamon.applets.windowListGroup", 'number-display', [(0, 'smart'), (1, 'normal'), (2, 'none')], "normal: display window number, smart: display window number if more than one window, none: don't display number")
	    self.thumbnail_settings = NewLabel('THUMBNAIL SETTINGS')
            self.thumbnail_size = GSettingsSpinButton("Size of Thumbnails", "org.cinnamon.applets.windowListGroup", "thumbnail-size", 5, 30, 1, 1, "Thumbnail Size; Default is ten")
            self.thumbnail_timeout = GSettingsSpinButton("Thumbnail Timeout", "org.cinnamon.applets.windowListGroup", "thumbnail-timeout", 0, 2000, 100, 1000, "Thumbnail timeout in milliseconds")
	    self.sort_thumnails = GSettingsComboBox('Sort Thumbnails', "org.cinnamon.applets.windowListGroup", 'sort-thumbnails', [(0, 'Last focused'), (1, 'Order opened')], "opened: sort by first opened, focused: sort by last focused")
	    self.hover_peek_settings = NewLabel('HOVER PEEK SETTINGS')
            self.hover_peek = GSettingsCheckButton('Enable Hover Peek', "org.cinnamon.applets.windowListGroup", "enable-hover-peek", "Checked: enable hover peek, else: disable it")
            self.window_opacity = GSettingsSpinButton("Window Opacity", "org.cinnamon.applets.windowListGroup", "hover-peek-opacity", 0, 255, 10, 100, "Opacity of the windows when peeked")
            self.peek_time = GSettingsSpinButton("Fade in/out Time", "org.cinnamon.applets.windowListGroup", "hover-peek-time", 0, 1000, 10, 1000, "Hover Peek Fade in/out time")


            self.WLvbox = Gtk.VBox()
            self.ThNvbox = Gtk.VBox()
            self.HPvbox = Gtk.VBox()


            self.WLvbox.add(self.window_list_settings)
            self.WLvbox.add(self.list_title_display)
            self.WLvbox.add(self.list_group_apps)
            self.WLvbox.add(self.seperate_favorites)
            self.WLvbox.add(self.list_number_display)
	    self.NoteBK.append_page(self.WLvbox, Gtk.Label("List"))

            self.ThNvbox.add(self.thumbnail_settings)
            self.ThNvbox.add(self.thumbnail_size)
            self.ThNvbox.add(self.thumbnail_timeout)
            self.ThNvbox.add(self.sort_thumnails)
	    self.NoteBK.append_page(self.ThNvbox, Gtk.Label("Thumbs"))

            self.HPvbox.add(self.hover_peek_settings)
            self.HPvbox.add(self.hover_peek)
            self.HPvbox.add(self.window_opacity)
            self.HPvbox.add(self.peek_time)
	    self.NoteBK.append_page(self.HPvbox, Gtk.Label("Peek"))
		

        self.window.add(self.NoteBK)
        self.window.show_all()

def main():
    CinnamonListSettings()
    Gtk.main()

if __name__ == '__main__':
    main()
