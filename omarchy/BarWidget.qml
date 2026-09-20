import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

BarWidget {
    id: root
    moduleName: "puplerbar"

    property var entry: null
    property string error: "Connecting to Pupler…"
    property bool busy: false
    property bool needsConfig: false
    property bool editingConfig: false
    property var projects: []
    property string selectedProject: ""
    property bool creatingProject: false
    property string serverUrl: "http://localhost:5995"
    property string positionError: ""
    readonly property var barLayout: bar && bar.shell ? bar.shell.barConfig.layout : ({})
    readonly property string clockId: bar && bar.shell ? String(bar.shell.barConfig.centerAnchor || "omarchy.clock") : "omarchy.clock"
    readonly property string currentPosition: {
        var sections = ["left", "center", "right"]
        for (var s = 0; s < sections.length; s++) {
            var section = sections[s]
            var entries = barLayout && barLayout[section] ? barLayout[section] : []
            for (var i = 0; i < entries.length; i++) {
                if (entryId(entries[i]) === moduleName) {
                    if (section !== "center") return section
                    return i + 1 < entries.length && entryId(entries[i + 1]) === clockId ? "center" : ""
                }
            }
        }
        return ""
    }
    readonly property var projectOptions: projects.map(function(project) {
        return { value: String(project.id), label: project.name, description: project.client ? project.client.name : "" }
    })
    readonly property bool starting: !configuring && entry === null
    readonly property bool canStart: starting && !creatingProject && !busy && error === "" && projects.some(function(project) { return String(project.id) === selectedProject })
    readonly property bool configuring: needsConfig || editingConfig
    property double now: Date.now()
    readonly property bool opened: menu.opened
    readonly property bool popoutSwitchClosing: menu.popoutSwitchClosing
    readonly property string title: entry ? (entry.description || (entry.project ? entry.project.name : "Timer")) : "No active timer"
    readonly property string elapsed: {
        var seconds = entry ? Math.max(0, Math.floor((now - Date.parse(entry.started_at)) / 1000)) : 0
        return Math.floor(seconds / 3600) + ":" + String(Math.floor(seconds / 60) % 60).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0")
    }
    readonly property bool canStop: entry !== null && entry.project_id !== null && !busy && error === ""
    implicitWidth: button.implicitWidth
    implicitHeight: barSize

    function open() { menu.open(); refresh() }
    function openPupler() {
        var url = configuring ? urlField.text.trim() : serverUrl
        if (!/^https?:\/\//i.test(url)) {
            error = "Enter an HTTP or HTTPS Pupler server URL."
            return
        }
        if (Qt.openUrlExternally(url)) close()
        else error = "Could not open Pupler in the browser."
    }
    function entryId(item) { return typeof item === "string" ? item : item.id }
    function movePosition(position) {
        if (["left", "center", "right"].indexOf(position) < 0) return
        var registry = bar && bar.shell ? bar.shell.pluginRegistry : null
        if (!registry || typeof registry.moveBarWidget !== "function") {
            positionError = "This Omarchy bar does not support moving widgets."
            return
        }
        var placement = position === "center" ? { section: "center", before: clockId } : { section: position }
        positionError = ""
        var moveError = registry.moveBarWidget(moduleName, placement)
        if (moveError) positionError = String(moveError)
    }
    function close() { projectPicker.close(); menu.close(); apiKeyField.text = "" }
    function closeForPopoutSwitch() { menu.closeForPopoutSwitch() }
    function send(command) {
        if (busy || !helper.running) return
        busy = true
        helper.write(JSON.stringify(command) + "\n")
    }
    function refresh() { send({action: "status", includeProjects: opened}) }
    function stop() { if (canStop) send({action: "stop", id: entry.id}) }
    function start() { if (canStart) send({action: "start", projectId: Number(selectedProject), description: descriptionField.text}) }
    function showNewProject() {
        creatingProject = true
        projectPicker.close()
        Qt.callLater(function() { projectNameField.forceActiveFocus() })
    }
    function createProject() {
        if (!starting || busy || !projectNameField.text.trim()) return
        send({action: "create-project", projectName: projectNameField.text})
    }
    function saveConfig() {
        if (busy || !helper.running || !apiKeyField.text.trim()) return
        send({action: "configure", baseUrl: urlField.text, apiKey: apiKeyField.text})
        apiKeyField.text = ""
    }

    IpcHandler {
        target: root.moduleName
        function status(): string {
            return JSON.stringify({ running: helper.running, busy: root.busy, entryId: root.entry ? root.entry.id : null, error: root.error, opened: root.opened, needsConfig: root.needsConfig, setupVisible: root.opened && root.configuring, startVisible: root.opened && root.starting, projectCount: root.projects.length, newProjectVisible: root.opened && root.starting && root.creatingProject, position: root.currentPosition, positionError: root.positionError })
        }
        function open() { root.open() }
        function close() { root.close() }
        function newProject() { root.open(); root.showNewProject() }
        function move(position: string) { root.movePosition(position) }
    }

    Process {
        id: helper
        command: [String(root.setting("bunPath", "bun")), decodeURIComponent(Qt.resolvedUrl("tracker.ts").toString().replace(/^file:\/\//, ""))]
        stdinEnabled: true
        running: true
        onStarted: root.refresh()
        stdout: SplitParser {
            onRead: function(line) {
                root.busy = false
                try {
                    var result = JSON.parse(line)
                    if (result.entry !== undefined) root.entry = result.entry
                    root.error = result.error || ""
                    root.needsConfig = result.needsConfig === true
                    if (result.projects) {
                        root.projects = result.projects
                        if (!root.projects.some(function(project) { return String(project.id) === root.selectedProject })) root.selectedProject = ""
                    }
                    if (result.createdProject) {
                        var project = result.createdProject
                        root.projects = root.projects.filter(function(item) { return item.id !== project.id }).concat([project])
                        root.selectedProject = String(project.id)
                        projectNameField.text = ""
                        root.creatingProject = false
                        descriptionField.forceActiveFocus()
                    }
                    if (result.started) { descriptionField.text = ""; projectPicker.close(); keys.forceActiveFocus() }
                    if (result.saved) root.editingConfig = false
                    if (result.baseUrl) root.serverUrl = result.baseUrl
                    if (!urlField.activeFocus && !root.editingConfig && result.baseUrl) urlField.text = result.baseUrl
                    if (root.configuring && root.opened) Qt.callLater(function() { apiKeyField.forceActiveFocus() })
                } catch (e) {
                    root.entry = null
                    root.error = "Invalid tracker response"
                }
            }
        }
        onExited: {
            root.busy = false
            root.entry = null
            root.error = "Tracker helper stopped. Check Bun is installed."
            restart.restart()
        }
    }
    Timer { id: restart; interval: 5000; onTriggered: helper.running = true }
    Timer { interval: 5000; running: !root.configuring && !root.creatingProject; repeat: true; onTriggered: root.refresh() }
    Timer { interval: 1000; running: true; repeat: true; onTriggered: root.now = Date.now() }

    WidgetButton {
        id: button
        bar: root.bar
        text: root.needsConfig ? "◷ Set up Pupler" : root.error ? "◷ Pupler !" : root.entry ? "◷ " + root.elapsed + (root.vertical ? "" : " · " + root.title.slice(0, 32)) : "◷ Pupler"
        tooltipText: root.needsConfig ? "Click to configure your Pupler API key" : root.error || (root.title + (root.entry ? " · " + root.elapsed : ""))
        onPressed: function(button) {
            if (button === Qt.RightButton) { root.editingConfig = true; root.open() }
            else if (root.opened) root.close()
            else root.open()
        }
    }

    Panel {
        id: menu
        bar: root.bar
        moduleName: root.moduleName
        manageIpc: false
        onOpenedChanged: if (!opened) root.creatingProject = false

        KeyboardPanel {
            id: popup
            anchorItem: button
            owner: root
            bar: root.bar
            open: menu.opened
            focusTarget: root.configuring ? apiKeyField : root.starting ? (root.creatingProject ? projectNameField : descriptionField) : keys
            contentWidth: fittedContentWidth(Style.space(360))
            contentHeight: fittedContentHeight(content.implicitHeight, Style.space(900))

            PanelKeyCatcher {
                id: keys
                anchors.fill: parent
                blocked: root.configuring || root.starting || projectPicker.popupOpen || positionSelector.activeFocus || openPuplerButton.activeFocus
                onTabRequested: positionSelector.forceActiveFocus()
                onCloseRequested: root.close()
                onActivateRequested: root.stop()
                onTextKey: function(text) { if (text === "r") root.refresh() }

                Column {
                    id: content
                    width: parent.width
                    spacing: Style.space(14)
                    Text {
                        width: parent.width
                        text: root.configuring ? "Set up Puplerbar" : "Pupler · " + root.title
                        textFormat: Text.PlainText
                        wrapMode: Text.Wrap
                        color: Color.foreground
                        font.pixelSize: Style.font.body
                    }
                    Button {
                        id: openPuplerButton
                        text: "Open Pupler"
                        onClicked: root.openPupler()
                        Keys.onEscapePressed: root.close()
                    }
                    Column {
                        width: parent.width
                        spacing: Style.space(6)
                        Text {
                            text: "Toolbar position"
                            color: Color.muted
                            font.pixelSize: Style.font.body
                        }
                        ButtonGroup {
                            id: positionSelector
                            options: [
                                { value: "left", label: "Left" },
                                { value: "center", label: "Before clock" },
                                { value: "right", label: "Right" }
                            ]
                            value: root.currentPosition
                            onChanged: function(value) { root.movePosition(value) }
                            Keys.onEscapePressed: root.close()
                        }
                        Text {
                            width: parent.width
                            visible: root.positionError !== ""
                            text: root.positionError
                            textFormat: Text.PlainText
                            wrapMode: Text.Wrap
                            color: Color.urgent
                            font.pixelSize: Style.font.body
                        }
                    }
                    Column {
                        visible: root.configuring
                        width: parent.width
                        spacing: Style.space(10)
                        Text {
                            width: parent.width
                            text: "Create a key in Pupler Settings → API keys, then paste it here."
                            wrapMode: Text.Wrap
                            color: Color.foreground
                            font.pixelSize: Style.font.body
                        }
                        TextField {
                            id: urlField
                            width: parent.width
                            text: "http://localhost:5995"
                            placeholderText: "Pupler server URL"
                            enabled: !root.busy
                            onAccepted: apiKeyField.forceActiveFocus()
                            Keys.onEscapePressed: root.close()
                        }
                        TextField {
                            id: apiKeyField
                            width: parent.width
                            placeholderText: "API key (pupler_…)"
                            password: true
                            enabled: !root.busy
                            onAccepted: root.saveConfig()
                            Keys.onEscapePressed: root.close()
                        }
                        Button {
                            text: root.busy ? "Connecting…" : "Save and connect"
                            enabled: !root.busy && apiKeyField.text.trim() !== ""
                            onClicked: root.saveConfig()
                            Keys.onEscapePressed: root.close()
                        }
                    }
                    Column {
                        visible: root.starting
                        width: parent.width
                        spacing: Style.space(10)
                        SearchableDropdown {
                            id: projectPicker
                            width: parent.width
                            label: "Project"
                            value: root.selectedProject
                            options: root.projectOptions
                            placeholderText: "Choose a project"
                            onChanged: function(value) { root.selectedProject = value }
                            Keys.onEscapePressed: {
                                if (popupOpen) close()
                                else root.close()
                            }
                        }
                        Button {
                            id: newProjectButton
                            visible: !root.creatingProject
                            text: "+ New project"
                            enabled: !root.busy
                            onClicked: root.showNewProject()
                            Keys.onEscapePressed: root.close()
                        }
                        Column {
                            visible: root.creatingProject
                            width: parent.width
                            spacing: Style.space(8)
                            TextField {
                                id: projectNameField
                                width: parent.width
                                placeholderText: "New project name"
                                enabled: !root.busy
                                onAccepted: root.createProject()
                                Keys.onEscapePressed: { root.creatingProject = false; descriptionField.forceActiveFocus() }
                            }
                            Row {
                                spacing: Style.space(8)
                                Button {
                                    text: root.busy ? "Creating…" : "Create project"
                                    enabled: !root.busy && projectNameField.text.trim() !== ""
                                    onClicked: root.createProject()
                                }
                                Button {
                                    text: "Cancel"
                                    enabled: !root.busy
                                    onClicked: { root.creatingProject = false; descriptionField.forceActiveFocus() }
                                }
                            }
                        }
                        TextField {
                            id: descriptionField
                            width: parent.width
                            placeholderText: "What are you working on? (optional)"
                            onAccepted: root.start()
                            Keys.onEscapePressed: root.close()
                        }
                        Button {
                            text: root.busy ? "Working…" : "Start timer"
                            enabled: root.canStart
                            onClicked: root.start()
                            Keys.onEscapePressed: root.close()
                        }
                        Text {
                            visible: root.projects.length === 0 && !root.busy && root.error === ""
                            width: parent.width
                            text: "Choose New project above to start tracking time."
                            wrapMode: Text.Wrap
                            color: Color.muted
                            font.pixelSize: Style.font.body
                        }
                    }
                    Text {
                        visible: !root.configuring && root.entry !== null
                        text: root.elapsed
                        color: Color.accent
                        font.pixelSize: Style.font.display
                    }
                    Text {
                        width: parent.width
                        text: root.error || (root.entry && root.entry.project_id === null ? "Choose a project in Pupler before stopping." : root.entry && root.entry.project ? root.entry.project.name : "")
                        textFormat: Text.PlainText
                        visible: text !== ""
                        wrapMode: Text.Wrap
                        color: root.error ? Color.urgent : Color.foreground
                    }
                    Rectangle {
                        visible: !root.configuring && !root.starting
                        width: parent.width
                        height: Style.space(40)
                        radius: Style.cornerRadius
                        color: Color.accent
                        opacity: root.canStop ? 1 : 0.4
                        Text {
                            anchors.centerIn: parent
                            text: root.busy ? "Working…" : "Stop timer · Enter"
                            color: Color.background
                            font.pixelSize: Style.font.body
                        }
                        MouseArea {
                            anchors.fill: parent
                            enabled: root.canStop
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.stop()
                        }
                    }
                    Text {
                        text: root.configuring ? "Enter: save · Esc: close" : root.starting ? "Enter: start · Esc: close · Right-click: setup" : "R: refresh · Esc: close · Right-click: setup"
                        color: Color.muted
                        font.pixelSize: Style.font.body
                    }
                }
            }
        }
    }
}
