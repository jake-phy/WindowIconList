#!/usr/bin/env python2.7

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
        self.settings = Gio.Settings.new(schema)
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
        self.settings = Gio.Settings.new(schema)
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

class GSettingsRadioButton(Gtk.HBox):
    def __init__(self, label, schema, key, items, tooltip=None):
        self.key = key
	self.items = items
        super(GSettingsRadioButton, self).__init__()
        self.label = Gtk.Label(label)
	self.vbox = Gtk.VBox()
	self.label = NewLabel(label, tooltip)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.vbox, False, False, 2)

        self.buttonFirst = None
        self.settings = Gio.Settings.new(schema)
        self.active = self.settings.get_enum(self.key)
        for (idx,item) in self.items:
            button = Gtk.RadioButton(group=self.buttonFirst, label=item)
            if not(self.buttonFirst): self.buttonFirst = button
            button.set_active(self.active == idx)
            button.connect('toggled', self.on_my_value_changed)
	    NewTooltip(button, tooltip)
            self.vbox.add(button)

    def on_my_value_changed(self, widget):
        if widget.get_active():
            val = [item[0] for item in self.items if item[1] == widget.get_label()][0]
            self.settings.set_enum(self.key, val)

class CinnamonListSettings:

    def __init__(self):
        self.window = Gtk.Window(title='Window List Settings')
        self.window.connect('destroy', Gtk.main_quit)
	self.window.set_default_size(320, 50)
	self.window.set_border_width(5)
	self.window.set_position(Gtk.WindowPosition.CENTER)

	self.space = NewLabel('')
	self.space2 = NewLabel('')
	self.space3 = NewLabel('')

	self.window_list_settings = NewLabel('WINDOW LIST SETTINGS')
	self.list_title_display = GSettingsRadioButton('Window Title Display', "org.cinnamon.applets.windowListGroup", 'title-display', [(0, 'none'), (1, 'app'), (2, 'title'), (3, 'focused')], "title: display the window title, app: diplay app name, none: don't display anything")
        self.list_group_apps = GSettingsCheckButton("Group Apps into one Icon", "org.cinnamon.applets.windowListGroup", "group-apps", "Checked: group windows into one app icon, else: every window has it's own icon")
        self.seperate_favorites = GSettingsRadioButton('Favorites Display', "org.cinnamon.applets.windowListGroup", 'favorites-display', [(0, 'favorites'), (1, 'pinned'), (2, 'none')], "favorites: display the favorites, pinned: display pinned apps instead of favorites, none: don't display anything")
	self.list_number_display = GSettingsRadioButton('List Number Display', "org.cinnamon.applets.windowListGroup", 'number-display', [(0, 'smart'), (1, 'normal'), (2, 'none')], "normal: display window number, smart: display window number if more than one window, none: don't display number")
	self.thumbnail_settings = NewLabel('THUMBNAIL SETTINGS')
        self.thumbnail_size = GSettingsSpinButton("Size of Thumbnails", "org.cinnamon.applets.windowListGroup", "thumbnail-size", 5, 30, 1, 1, "Thumbnail Size; Default is ten")
        self.thumbnail_timeout = GSettingsSpinButton("Thumbnail Timeout", "org.cinnamon.applets.windowListGroup", "thumbnail-timeout", 0, 2000, 100, 1000, "Thumbnail timeout in milliseconds")
	self.sort_thumnails = GSettingsRadioButton('Sort Thumbnails', "org.cinnamon.applets.windowListGroup", 'sort-thumbnails', [(0, 'Last focused'), (1, 'Order opened')], "opened: sort by first opened, focused: sort by last focused")
	self.hover_peek_settings = NewLabel('HOVER PEEK SETTINGS')
        self.hover_peek = GSettingsCheckButton('Enable Hover Peek', "org.cinnamon.applets.windowListGroup", "enable-hover-peek", "Checked: enable hover peek, else: disable it")
        self.window_opacity = GSettingsSpinButton("Window Opacity", "org.cinnamon.applets.windowListGroup", "hover-peek-opacity", 0, 255, 10, 100, "Opacity of the windows when peeked")
        self.peek_time = GSettingsSpinButton("Fade in/out Time", "org.cinnamon.applets.windowListGroup", "hover-peek-time", 0, 1000, 10, 1000, "Hover Peek Fade in/out time")

        self.vbox = Gtk.VBox();
        self.vbox.add(self.window_list_settings)
        self.vbox.add(self.list_title_display)
        self.vbox.add(self.list_group_apps)
        self.vbox.add(self.seperate_favorites)
        self.vbox.add(self.space3)
        self.vbox.add(self.list_number_display)
        self.vbox.add(self.space)
        self.vbox.add(self.thumbnail_settings)
        self.vbox.add(self.thumbnail_size)
        self.vbox.add(self.thumbnail_timeout)
        self.vbox.add(self.sort_thumnails)
        self.vbox.add(self.space2)
        self.vbox.add(self.hover_peek_settings)
        self.vbox.add(self.hover_peek)
        self.vbox.add(self.window_opacity)
        self.vbox.add(self.peek_time)
        self.vbox.show_all()
        self.window.add(self.vbox)
        self.window.show_all()

def main():
    CinnamonListSettings()
    Gtk.main()

if __name__ == '__main__':
    main()
