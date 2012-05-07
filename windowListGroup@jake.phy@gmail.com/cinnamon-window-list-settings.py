#!/usr/bin/env python2.7

from gi.repository import Gtk, Gio, Gdk

class WindowLabel(Gtk.Label):
    def __init__(self, label):
        super(WindowLabel, self).__init__(label)

class GSettingsCheckButton(Gtk.HBox):
    def __init__(self, label, schema, key):
        self.key = key
        super(GSettingsCheckButton, self).__init__()
        self.label = Gtk.Label(label)
	self.button = Gtk.CheckButton()
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.button, False, False, 2)
        self.settings = Gio.Settings.new(schema)
        self.button.set_active(self.settings.get_boolean(self.key))
        self.button.connect('toggled', self.on_my_value_changed)
        
    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.button.get_active())

class GSettingsSpinButton(Gtk.HBox):
    def __init__(self, label, schema, key, min, max, step, page):
        self.key = key
        super(GSettingsSpinButton, self).__init__()
        self.label = Gtk.Label(label)
        self.settings = Gio.Settings.new(schema)
	self.adjustment = Gtk.Adjustment(self.settings.get_int(self.key), min, max, step, page, 0)
        self.content_widget = Gtk.SpinButton()
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_end(self.content_widget, False, False, 2)

        self.content_widget.set_adjustment(self.adjustment)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        
    def on_my_value_changed(self, widget):
        self.settings.set_int(self.key, widget.get_value())

class GSettingsRadioButton(Gtk.HBox):
    def __init__(self, label, schema, key, items):
        self.key = key
	self.items = items
        super(GSettingsRadioButton, self).__init__()
        self.label = Gtk.Label(label)
	self.vbox = Gtk.VBox()
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
            self.vbox.add(button)

    def on_my_value_changed(self, widget):
        if widget.get_active():
            val = [item[0] for item in self.items if item[1] == widget.get_label()][0]
            self.settings.set_enum(self.key, val)

class CinnamonListSettings:

    def __init__(self):
        self.window = Gtk.Window(title='Window List Settings')
        self.window.connect('destroy', Gtk.main_quit)
	self.space = WindowLabel('')
	self.space2 = WindowLabel('')

	self.window_list_settings = WindowLabel('WINDOW LIST SETTINGS')
	self.list_title_display = GSettingsRadioButton('Window Title Display', "org.cinnamon.applets.windowListGroup", 'title-display', [(0, 'none'), (1, 'app'), (2, 'title')])
        self.list_show_favs = GSettingsCheckButton("Show Favorites", "org.cinnamon.applets.windowListGroup", "show-favorites")
        self.list_group_apps = GSettingsCheckButton("Group Apps into one icon", "org.cinnamon.applets.windowListGroup", "group-apps")
	self.list_number_display = GSettingsRadioButton('List Number Display', "org.cinnamon.applets.windowListGroup", 'number-display', [(0, 'smart'), (1, 'normal'), (2, 'none')])
	self.thumbnail_settings = WindowLabel('THUMBNAIL SETTINGS')
        self.thumbnail_size = GSettingsSpinButton("Size of Thumbnails", "org.cinnamon.applets.windowListGroup", "thumbnail-size", 2, 15, 1, 1)
        self.thumbnail_timeout = GSettingsSpinButton("Thumbnail Timeout", "org.cinnamon.applets.windowListGroup", "thumbnail-timeout", 0, 2000, 100, 1000)
	self.sort_thumnails = GSettingsRadioButton('Sort Thumbnails', "org.cinnamon.applets.windowListGroup", 'sort-thumbnails', [(0, 'Last focused'), (1, 'Order opened')])
	self.hover_peek_settings = WindowLabel('HOVER PEEK SETTINGS')
        self.hover_peek = GSettingsCheckButton('Enable Hover Peek', "org.cinnamon.applets.windowListGroup", "enable-hover-peek")
        self.window_opacity = GSettingsSpinButton("Window Opacity", "org.cinnamon.applets.windowListGroup", "hover-peek-opacity", 0, 255, 10, 100)
        self.peek_time = GSettingsSpinButton("Fade in/out Time", "org.cinnamon.applets.windowListGroup", "hover-peek-time", 0, 1000, 10, 1000)

        self.vbox = Gtk.VBox();
        self.vbox.add(self.window_list_settings)
        self.vbox.add(self.list_title_display)
        self.vbox.add(self.list_show_favs)
        self.vbox.add(self.list_group_apps)
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
