import {dom, element} from 'deku'
import {EventEmitter} from 'events'
const {createRenderer} = dom;
const emitter = new EventEmitter;
let counter = 0;
// Dispatch an action when the button is clicked
let log = event => {
    emitter.emit("update");
};
// Define a state-less component
let MyButton = {
    onUpdate({path}){
        console.log(`${counter} onUpdate : ${path}`);
    },
    render({path, children}){
        console.log(`${++counter} render : ${path}`);
        return <button onClick={log}>{children}</button>
    }
};
let MyWrapper = {
    render(){
        return <div>
            <MyButton>Hello World!</MyButton>
        </div>
    }
};
let render = createRenderer(document.body);
emitter.on("update", ()=> {
    render(<MyWrapper />);
});
// init
emitter.emit("update");