# WooT
DUniter Web of Trust 3D visualization

Made to be used with a three.js editor es7 compliant (it depends on esprima version).
There is a good version here http://three.devingfx.com

## Open

TODO

## Edit

Open WooT.app.json into the editor by clicking on `File` > `Import`.
The content of the app is added by import, so don't forget to  `File` > `New` if you had a loaded scene.

## Dependencies

This app uses several editor's script you can found [here](https://github.com/devingfx/three-editor-scripts) :

- **dat.gui** To get menus
- **CANNON** To get physics
- **OrbitControl** To move the camera
- **Loki** and **Loki.IndexedAdapter** To get a noSQL DB stored in IndexedDB
- **du/BlockchainDB.js** To load and get DUniter's blockchain data
- **du/BlockReader.js** To play the blockchain block by block