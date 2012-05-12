#!/bin/sh

UUID="WindowListGroup@jake.phy@gmail.com"
OLD_UUID="windowListGroup@jake.phy@gmail.com"
SCHEMA_NAME="windowListGroup"
OLD_SCHEMA_NAME="windowListGroup"
SCHEMA_DIR="/usr/share/glib-2.0/schemas/"
OLD_SCHEMA="org.cinnamon.applets.${OLD_SCHEMA_NAME}.gschema.xml"
SCHEMA="org.cinnamon.applets.${SCHEMA_NAME}.gschema.xml"
INSTALL_DIR="${HOME}/.local/share/cinnamon/applets/${UUID}"
OLD_INSTALL_DIR="${HOME}/.local/share/cinnamon/applets/${OLD_UUID}"

compile_schemas() {
		glib-compile-schemas --dry-run ${SCHEMA_DIR} &&
		sudo glib-compile-schemas ${SCHEMA_DIR}
}

do_install() {

	do_cleanup
	cat << EOF

	Installing applet in ${INSTALL_DIR}...
EOF
	
	sudo cp -f ${SCHEMA} ${SCHEMA_DIR} && compile_schemas

	mkdir -p ${INSTALL_DIR}

	cp -f metadata.json applet.js cinnamon-window-list-settings.py icon.png specialButtons.js specialMenus.js ${INSTALL_DIR}

}

do_uninstall() {
	cat << EOF

	Removing applet from ${INSTALL_DIR} ...
EOF
	if [ -f "${SCHEMA_DIR}/${SCHEMA}" ]; then
		sudo rm -f ${SCHEMA_DIR}/${SCHEMA}
		dconf reset -f /org/cinnamon/applets/${SCHEMA_NAME}/
	fi

	compile_schemas

	rm -rf ${INSTALL_DIR}

}

# housekeeping for poor namespace convention < v1.3.2
do_cleanup() {
	cat << EOF

	Removing old installation of applet from ${OLD_INSTALL_DIR}...
EOF
	if [ -f "${SCHEMA_DIR}/${OLD_SCHEMA}" ]; then
		sudo rm -f ${SCHEMA_DIR}/${OLD_SCHEMA}
		# this location may contain other data
		dconf reset -f /org/cinnamon/applets/${OLD_SCHEMA_NAME}/
	fi
	
	compile_schemas
	
	rm -rf ${OLD_INSTALL_DIR}
		
}

case `basename $0` in
	"install.sh")
		do_install
		;;
	"uninstall.sh")
		do_uninstall
		;;
	"cleanup.sh")
		do_cleanup
		;;
esac

	cat << EOF

    	Cinnamon needs to be restarted for applet to load
EOF
