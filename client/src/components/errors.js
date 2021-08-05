import {ACTIONS} from "../store";


  

export default function Errors(props){
    function clearErrors(){
        props.dispatch({
                type: ACTIONS.ERROR, 
                payload: {errors: []}
        })
    }
    let errorClasses = "noselect";
    if(props.state.errors.length === 0){
        errorClasses += " hidden"
    }
    return <div id="error-window" className={errorClasses} onClick={clearErrors}>
        <div id="error-header">
            <div><h1>Errors</h1></div>
        </div>
        <div id="error-body">
            {props.state.errors.map((err, ind) => <div key={`err${ind}`} className="errors">{err}</div>)}
        </div>
    </div>
}