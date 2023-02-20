# Battlemap

This project is a web-based Virtual TableTop system, that allows easy creation of maps and characters for RPG like games.

Can be easily used either locally, with a multi-monitor setup, or remotely, over the web, with players receiving updates in real-time.

This project is currently in a work-in-progess state, with frequent updates.

## Features

* Map creation where you can easily add multiple layers, each of which can be separately toggle for visibility, allowing hidden tokens, simple doors/windows, multi-levelled maps, and much more.
* Character creation, so you can easily reuse monsters, NPCs and players across maps.
* Dynamic, top-down, ray-traced, vector based lighting system, allowing for more atmospheric looking maps.
* Multi-track Audio system that synchronises audio across all clients.
* Tree-based sorting system for images, audio, characters, and maps to make finding your assets and creations easier.
* Customisable, Window based layout system.
* Key binding to many of the features allowing quicker access to tools 
* Internationalisation support built in, allowing for easy translation of all text.
* Plug-in architecture allowing new features to be implemented without changing the base code, or restricting the possibility of other, non-core features.
* And much, much more.

## Running

`cmd/battlemap` contains an example main file which can be used to run a local battlemap instance. The command can take the following flags:

|  Flag  |  Default  |  Description  |
|--------|-----------|---------------|
| user   | ""        | Username for admin login. |
| pass   | ""        | Password for admin login. |
| path   | [ConfigDir](https://pkg.go.dev/os#UserConfigDir)/battlemap | Location to store Battlemap data. |
| port   | 8080      | Port on which to run the webserver. |
