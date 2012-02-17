const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Tweener = imports.ui.tweener;
const Overview = imports.ui.overview;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const AltTab = imports.ui.altTab;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('cinnamon-extensions');
const _ = Gettext.gettext;

const Extension = imports.ui.extensionSystem.extensions['WindowIconList@jake.phy@gmail.com'];
const SpecialMenus = Extension.specialMenus;


const PANEL_ICON_SIZE = 24;
const SPINNER_ANIMATION_TIME = 1;

function AppMenuButton(app, metaWindow, animation) {
    this._init(app, metaWindow, animation);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(app, metaWindow, animation, jumpList) {
            this.actor = new St.Bin({ style_class: 'window-list-item-box',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        

        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

		this.metaWindow = metaWindow;
		this.app = app;
		
        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this._container = new Cinnamon.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);

        this._iconBottomClip = 0;

        this._visible = !Main.overview.visible;
        if (!this._visible)
            this.actor.hide();
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.show();
        }));
        Main.overview.connect('showing', Lang.bind(this, function () {
            this.hide();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        
        this._updateCaptionId = this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            this._label.set_text('');
        }));
                
        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

		let icon = this.app.create_icon_texture(PANEL_ICON_SIZE);
		//let icon = this.app.get_faded_icon(1.15 * PANEL_ICON_SIZE);		        
        this._label.set_text('');
        this._iconBox.set_child(icon);
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}
        
        //set up the right click menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
	let AppMenuButtonRightClickMenu = SpecialMenus.AppMenuButtonRightClickMenu; 
        this.rightClickMenu = new AppMenuButtonRightClickMenu(this.actor, app, this.metaWindow);
        this._menuManager.addMenu(this.rightClickMenu);
        // Set up the hover menu
        this.hoverMenu = new Extension.specialMenus.AppThumbnailHoverMenu(this.actor, this.metaWindow, this.app)
        this.hoverController = new Extension.specialMenus.HoverMenuController(this.actor, this.hoverMenu);
    },
    
    _onDestroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
    },
    
    doFocus: function() {
        //let tracker = Cinnamon.WindowTracker.get_default();
        //let focusedApp = tracker.focus_app;    
        if (this.metaWindow.has_focus()) {
            this.actor.add_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(PANEL_ICON_SIZE);
	    this._iconBox.set_child(icon);
        }
        else {
            this.actor.remove_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(PANEL_ICON_SIZE);
	    this._iconBox.set_child(icon);
        }
    },
    
    _onButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this.rightClickMenu.isOpen ) {
                this.rightClickMenu.toggle();                
            }
            if ( this.metaWindow.has_focus() ) {
                this.metaWindow.minimize(global.get_current_time());
                this.actor.remove_style_pseudo_class('focus');
            }
            else {
                this.metaWindow.activate(global.get_current_time());
                this.actor.add_style_pseudo_class('focus');	    
            }
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK) {
            this.metaWindow.delete(global.get_current_time());
            this.rightClickMenu.destroy();
        }  else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            if (!this.rightClickMenu.isOpen) {
                // Setting the max-height won't do any good if the minimum height of the
                // menu is higher then the screen; it's useful if part of the menu is
                // scrollable so the minimum height is smaller than the natural height
                //let monitor = global.get_primary_monitor();
                //this.rightClickMenu.actor.style = ('max-height: ' +
                //                         Math.round(200) +
                //                         'px;');
            }
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();   
        }   
    },
    
    show: function() {
        if (this._visible)
            return;
        this._visible = true;
        this.actor.show();
    },

    hide: function() {
        if (!this._visible)
            return;
        this._visible = false;
        this.actor.hide();
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('app-icon-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
       if (this._iconBottomClip > 0)
           this._iconBox.set_clip(0, 0,
                                 allocation.x2 - allocation.x1,
                                   allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    stopAnimation: function() {
        Tweener.addTween(this._spinner.actor,
                         { opacity: 0,
                           time: SPINNER_ANIMATION_TIME,
                           transition: "easeOutQuad",
                           onCompleteScope: this,
                           onComplete: function() {
                               this._spinner.actor.opacity = 255;
                               this._spinner.actor.hide();
                           }
                         });
    },

    startAnimation: function() {
        this._spinner.actor.show();
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
//        alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.min_size = alloc.min_size + Math.max(0, minSize);
//        alloc.natural_size = alloc.natural_size + Math.max(0, naturalSize - Math.floor(alloc.natural_size / 2));
        alloc.natural_size = PANEL_ICON_SIZE +6; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_height(forWidth);
        if (minSize > alloc.min_size)
            alloc.min_size = minSize;
        if (naturalSize > alloc.natural_size)
            alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = PANEL_ICON_SIZE;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth / 2) + this._label.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }
    }
};

function WindowList() {
    this._init();
}

WindowList.prototype = {
//    __proto__ : WindowList.prototype,

    _init: function() {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                        style_class: 'window-list-box' });
        this.actor._delegate = this;
        this._windows = new Array();
                
        let tracker = Cinnamon.WindowTracker.get_default();
        tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));

        global.window_manager.connect('switch-workspace',
                                        Lang.bind(this, this._refreshItems));
        global.window_manager.connect('minimize',
                                        Lang.bind(this, this._onMinimize));
        global.window_manager.connect('map',
                                        Lang.bind(this, this._onMap));
        
        this._workspaces = [];
        this._changeWorkspaces();
        global.screen.connect('notify::n-workspaces',
                                Lang.bind(this, this._changeWorkspaces));
                                
//        this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes));
    },

    _onFocus: function() {
        for ( let i = 0; i < this._windows.length; ++i ) {
            this._windows[i].doFocus();
        }
    },
    
    _refreshItems: function() {
        this.actor.destroy_children();
        this._windows = new Array();

        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        windows.sort(function(w1, w2) {
            return w1.get_stable_sequence() - w2.get_stable_sequence();
        });
                
        // Create list items for each window
        let tracker = Cinnamon.WindowTracker.get_default();
        for ( let i = 0; i < windows.length; ++i ) {
            let metaWindow = windows[i];
            if ( metaWindow && tracker.is_window_interesting(metaWindow) ) {
                let app = tracker.get_window_app(metaWindow);
                if ( app ) {
                    let appbutton = new AppMenuButton(app, metaWindow, false);
                    this._windows.push(appbutton);
                    this.actor.add(appbutton.actor);
                }
            }
        }

        this._onFocus();
    },

    _onMinimize: function(shellwm, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {                
                this._windows[i]._label.set_text("["+ actor.get_meta_window().get_title() +"]");     
                this._windows[i].rightClickMenu.itemMinimizeWindow.label.set_text("Restore");           
                return;
            }
        }
    },
    
    _onMap: function(shellwm, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {                
                this._windows[i]._label.set_text(actor.get_meta_window().get_title());                
                this._windows[i].rightClickMenu.itemMinimizeWindow.label.set_text("Minimize");
                return;
            }
        }
    },
  
    _windowAdded: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return;
            }
        }

        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        if ( app && tracker.is_window_interesting(metaWindow) ) {
            let appbutton = new AppMenuButton(app, metaWindow, true);
            this._windows.push(appbutton);
            this.actor.add(appbutton.actor);
        }
    },

    _windowRemoved: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                this.actor.remove_actor(this._windows[i].actor);
                this._windows[i].actor.destroy();
                this._windows.splice(i, 1);
                break;
            }
        }
    },
    
    _changeWorkspaces: function() {
        for ( let i=0; i<this._workspaces.length; ++i ) {
            let ws = this._workspaces[i];
            ws.disconnect(ws._windowAddedId);
            ws.disconnect(ws._windowRemovedId);
        }

        this._workspaces = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            let ws = global.screen.get_workspace_by_index(i);
            this._workspaces[i] = ws;
            ws._windowAddedId = ws.connect('window-added',
                                    Lang.bind(this, this._windowAdded));
            ws._windowRemovedId = ws.connect('window-removed',
                                    Lang.bind(this, this._windowRemoved));
        }
    },
    
    _allocateBoxes: function(container, box, flags) {	
		let allocWidth = box.x2 - box.x1;
		let allocHeight = box.y2 - box.y1;
		let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
		let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
		let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

		let sideWidth, centerWidth;
		centerWidth = centerNaturalWidth;
		sideWidth = (allocWidth - centerWidth) / 2;

		let childBox = new Clutter.ActorBox();

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.actor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = allocWidth - Math.min(allocWidth - rightNaturalWidth,
												leftNaturalWidth);
			childBox.x2 = allocWidth;
		} else {
			childBox.x1 = 0;
			childBox.x2 = Math.min(allocWidth - rightNaturalWidth, leftNaturalWidth);
		}
		this._leftBox.allocate(childBox, flags);

		childBox.x1 = Math.ceil(sideWidth);
		childBox.y1 = 0;
		childBox.x2 = childBox.x1 + centerWidth;
		childBox.y2 = allocHeight;
		this._centerBox.allocate(childBox, flags);

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.actor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = 0;
			childBox.x2 = Math.min(Math.floor(sideWidth),
								   rightNaturalWidth);
		} else {
			childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
												rightNaturalWidth);
			childBox.x2 = allocWidth;
		}
		this._rightBox.allocate(childBox, flags);
    },
};

let windowList;
let wdList;
let appMenu;

function init(extensionMeta) {

    imports.gettext.bindtextdomain('cinnamon-extensions', extensionMeta.localedir);        
    windowList = new WindowList();  
    appMenu = Main.appMenu;   
}

function enable() {	
    /* Create a Window List */ 
    wdList = Main.windowList;
    if (Main.desktop_layout == Main.LAYOUT_CLASSIC){
	Main.panel2._leftBox.remove_actor(wdList.actor);

    	Main.panel2._leftBox.add(windowList.actor, { x_fill: true, y_fill: true });
//	Main.panel2._leftBox.remove_actor(appMenu.actor);  
    }
    else{
	Main.panel._leftBox.remove_actor(wdList.actor);

    	Main.panel._leftBox.add(windowList.actor, { x_fill: true, y_fill: true });
    }
}

function disable() {            
    // Remove the window list
    wdList = Main.windowList;
    if (Main.desktop_layout == Main.LAYOUT_CLASSIC){
	Main.panel2._leftBox.remove_actor(windowList.actor);

    	Main.panel2._leftBox.add(wdList.actor, { x_fill: true, y_fill: true });
    }
    else{
	Main.panel._leftBox.remove_actor(windowList.actor);

    	Main.panel._leftBox.add(wdList.actor, { x_fill: true, y_fill: true });
    }
}
