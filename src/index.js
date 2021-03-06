// @flow

/**
 * Show the rotation circle and marker
 * dispatches drag events
 */

import React, { Component } from "react";
import utils from  "./utils";
import { Samy, SvgProxy } from "react-samy-svg";
import defaultSkin from "./knobdefaultskin";
import { KnobVisualHelpers } from "./helpers/KnobVisualHelpers";
import InternalInput from "./InternalInput";
import RotateView from './RotateView';
import * as d3 from 'd3';
import type {Point} from './Types'

/**
 * A skin consists of the svg code
 * and the knob element centerx and y (knobX, knobY)
 */
type Skin = {
  svg: string,
  knobX: number,
  knobY: number
};

type KnobProps = {
  value: ?number,
  defaultValue: ?number,
  min: number,
  max: number,
  skin: Skin,
  format: (val: number) => string,
  onChange: (val: number) => void,
  style: any,
  preciseMode: boolean,
  unlockDistance: number,
  step: number
};

type KnobState = {
  svgRef: any,
  dragging: boolean,
  dragDistance: number,
  mousePos: Point,
  valueAngle: number,
  uncontrolledValue: ?number
};

function printDebugValues(obj) {
  console.log('------------')
  Object.keys(obj).forEach((key)=>{
    const value = typeof obj[key] === 'object' ? JSON.stringify(obj[key]) : obj[key]
    console.log(`${key}: ${value}`)
  })
  console.log('------------')
  
}

/**
 * Generic knob component
 */
class Knob extends Component<KnobProps, KnobState> {
  container: any;
  scale: any;
  inputRef: any;
  controlled: boolean

  state = {
    svgRef: null,
    dragging: false,
    dragDistance: 0,
    mousePos: {x:0, y:0},
    valueAngle: 0,
    uncontrolledValue: 0,
  };

  static defaultProps = {
    min: 0,
    max: 100,
    onChange: function() {},
    skin: defaultSkin,
    format: (val: number) => {
      return val.toFixed(0);
    },
    preciseMode: true,
    unlockDistance: 100,
    defaultValue: 0,
    step: 1
  };
  componentDidMount() {
    if(this.props.value == null ) {
      /**
       * If the component is not controlled
       * then the state variable uncontrolledValue
       * will be used to store the current value
       */  
      this.controlled = false;
      this.setState({
        ...this.state,
        uncontrolledValue: this.props.defaultValue
      })

    } else {
      this.controlled = true;
    }
    this.setupDragging(d3.select(this.container));
  }

  componentWillReceiveProps(nextProps:KnobProps) {
    //should recalculate scale?
    const pmin = this.props.min;
    const pmax = this.props.max;
    const nmin = nextProps.min;
    const nmax = nextProps.max;

    if (pmin != nmin || pmax != nmax) {
      this.scale = d3
        .scaleLinear()
        .domain([nmin, nmax])
        .range([0, 359]);
    }
  }

  saveRef(elem: any) {
    if (!this.state.svgRef) {
      this.setState({ ...this.state, svgRef: elem });
    }
  }

  saveParentRef(container: any) {
    this.container = container;
  }

  onAngleChanged(angle: number) {
    //Calculate domain value
    let domainValue = this.scale.invert(angle);
    if(!this.controlled) {
      /**
       * If the mode is 'uncontrolled' we need to update our local state
       */
      this.setState((st)=>{
        return {uncontrolledValue: domainValue}
      })
    }
    this.props.onChange(domainValue);
  }

  /**
   * Returns the current value (depending on controlled/uncontrolled mode)
   */
  getValue():number {
    return this.controlled === true ? this.props.value : this.state.uncontrolledValue;
  }

  setupDragging(elem: d3.Selection<any>) {
    if (elem == null) {
      return;
    }
    // Add dragging behavior to selector element
    var self = this;
    let vbox = elem.node().getBoundingClientRect();
    const cx = vbox.width / 2;
    const cy = vbox.height / 2;
    
    
    function started() {

      let value = self.getValue();
      const initialAngle = self.scale(value);
      vbox = elem.node().getBoundingClientRect();;
      elem.classed("dragging", true);
      d3.event.on("drag", dragged).on("end", ended);
      //startPos = position relative to the box center
      //Note: the d3 event container is the same element, so coordinates
      //are relative to it.
      let startPos = { x: d3.event.x - cx, y: d3.event.y - cy };
      let startAngle = utils.getAngleForPoint(startPos.x, startPos.y);
      let lastPos = startPos;
      let lastAngle = utils.getAngleForPoint(lastPos.x, lastPos.y);
      //in precise mode, we won't monitor angle change unless the distance > unlockDistance
      let monitoring = false;
      self.setState({ ...self.state, dragging: true, dragDistance: 0,
        mousePos: {x: d3.event.sourceEvent.clientX, y: d3.event.sourceEvent.clientY}
      });
      

      function dragged() {
        let currentPos = { x: d3.event.x - cx, y: d3.event.y - cy };
        const distanceFromCenter = Math.sqrt(
          Math.pow(currentPos.x, 2) + Math.pow(currentPos.y, 2)
        );

        if (self.props.preciseMode) {
          if (
            !monitoring &&
            distanceFromCenter >= self.props.unlockDistance
          ) {
            //Start monitoring!
            //Reset startPos y startAngle
            startPos = currentPos;
            startAngle = utils.getAngleForPoint(currentPos.x, currentPos.y);
            monitoring = true;
          }
        } else {
          monitoring = true;
        }

        let currentAngle = utils.getAngleForPoint(currentPos.x, currentPos.y);
        
        const deltaAngle = currentAngle - startAngle;
        
        lastPos = currentPos;
        let finalAngle = (initialAngle + deltaAngle);
      
        if( finalAngle < 0 ) {
          //E.g -1 turns 359
          finalAngle+=360;
        } else if (finalAngle > 360 ) {
          finalAngle-=360;
        }

        // printDebugValues({
        //   cx,
        //   cy,
        //   initialAngle,
        //   startAngle,
        //   startPos,
        //   currentPos,
        //   currentAngle,
        //   deltaAngle,
        //   finalAngle,
        // })

  

        if (monitoring) {
          self.onAngleChanged(finalAngle);
        }
        self.setState(()=>{
          return { 
          ...self.state,
          dragDistance: distanceFromCenter, 
          mousePos: {x: d3.event.sourceEvent.clientX, y: d3.event.sourceEvent.clientY},
          valueAngle: monitoring ? finalAngle : initialAngle 
        }});

      }

      function ended() {
        elem.classed("dragging", false);
        self.setState({ ...self.state, dragging: false });

        //focus input so it can be moved with arrows
        self.inputRef.focus();
      }
    }

    const drag = d3.drag();
    //Change the container to the element itself so the
    //event.x and y are relative to the element , not its parent
    drag.container(function() {
      return elem.node();
    });
    elem.call(drag.on("start", started));
  }

  componentWillMount() {
    this.scale = d3
      .scaleLinear()
      .domain([this.props.min, this.props.max])
      .range([0, 360]);
  }

   onFormControlChange(newVal:number) {
    if(!this.controlled) {
      /**
       * If the mode is 'uncontrolled' we need to update our local state
       */
      this.setState({...this.state, uncontrolledValue: newVal})
    }

    this.props.onChange(newVal);
  };

  render() {
    const {
      value,
      defaultValue,
      min,
      max,
      onChange,
      skin,
      style,
      format,
      preciseMode,
      unlockDistance,
      ...rest
    } = this.props;

    const currentValue:number = this.getValue();
    const angle = this.scale(currentValue);


    const styles = {
      container: Object.assign(
        {},
        {
          width: "50px",
          height: "50px",
          overflow: "hidden",
          position: "relative"
        },
        style
      ),
      input: {
        width: "50%",
        position: "absolute",
        top: "0",
        left: "-100%"
      }
    };
    return (
      <React.Fragment>
        <div
          ref={this.saveParentRef.bind(this)}
          style={styles.container}
          {...rest}
        >
          <InternalInput
            inputRef={input => {
              this.inputRef = input;
            }}
            style={styles.input}
            value={currentValue}
            min={min}
            max={max}
            step={this.props.step}
            onChange={this.onFormControlChange.bind(this)}
          />

          <Samy
            width="100%"
            height="100%"
            svgXML={skin.svg}
            onSVGReady={this.saveRef.bind(this)}
          >
            <SvgProxy
              selector="#knob"
              transform={`$ORIGINAL rotate(${angle}, ${skin.knobX}, ${
                skin.knobY
              })`}
            />
            <SvgProxy selector="tspan">{this.props.format(currentValue)}</SvgProxy>
          </Samy>
        </div>
        {this.state.svgRef && (
          <RotateView svg={this.state.svgRef} angle={angle} />
        )}

        {this.state.dragging &&
          this.props.preciseMode && (
            <KnobVisualHelpers
              svgRef={this.state.svgRef}
              radius={this.state.dragDistance}
              mousePos={this.state.mousePos}
              minimumDragDistance={this.props.unlockDistance}
              valueAngle={this.state.valueAngle}
            />
          )}
      </React.Fragment>
    );
  }
}

export { Knob };
