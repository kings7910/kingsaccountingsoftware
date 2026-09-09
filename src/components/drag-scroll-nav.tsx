"use client";
import {useRef,type ComponentProps} from "react";

export function DragScrollNav({children,className,...props}:ComponentProps<"nav">){
  const drag=useRef<{pointerId:number;y:number;scrollTop:number}|null>(null);
  const suppressClick=useRef(false);
  return <nav {...props} className={`min-h-0 cursor-grab select-none ${className??""}`}
    onPointerDown={event=>{
      suppressClick.current=false;
      if(event.pointerType!=="mouse"||event.button!==0)return;
      drag.current={pointerId:event.pointerId,y:event.clientY,scrollTop:event.currentTarget.scrollTop};
    }}
    onPointerMove={event=>{
      const start=drag.current;if(!start||start.pointerId!==event.pointerId)return;
      if(!event.buttons){drag.current=null;return}
      const delta=event.clientY-start.y;
      if(!suppressClick.current&&Math.abs(delta)<5)return;
      suppressClick.current=true;
      if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor="grabbing";
      event.currentTarget.scrollTop=start.scrollTop-delta;
      event.preventDefault();
    }}
    onPointerUp={event=>{
      drag.current=null;event.currentTarget.style.cursor="";
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={event=>{drag.current=null;event.currentTarget.style.cursor=""}}
    onLostPointerCapture={event=>{drag.current=null;event.currentTarget.style.cursor=""}}
    onClickCapture={event=>{if(suppressClick.current&&event.detail!==0){event.preventDefault();event.stopPropagation();suppressClick.current=false}}}
    onDragStart={event=>event.preventDefault()}
  >{children}</nav>;
}
