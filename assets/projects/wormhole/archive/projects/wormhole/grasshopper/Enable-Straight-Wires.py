# Run with Rhino's RunPythonScript command after opening Grasshopper.
# Reversible native canvas style. Does not change definition connections.
import clr,scriptcontext as sc,os,json
clr.AddReference('Grasshopper');clr.AddReference('System.Drawing')
import Grasshopper as GH
from System.Drawing import Color,PointF,Pen
from System.Drawing.Drawing2D import SmoothingMode
cv=GH.Instances.ActiveCanvas
key='fabrication_native_straight_wire_style'
previous=sc.sticky.get(key)
if previous:
    old_canvas,old_before,old_after=previous
    old_canvas.CanvasPrePaintWires-=old_before
    old_canvas.CanvasPostPaintWires-=old_after
state=[]
route_lookup={}
routefile=os.path.join(os.path.dirname(globals().get('__file__','')),'native-route-data.json')
if os.path.isfile(routefile):
    with open(routefile) as file:
        for job in json.load(file):
            for route in job['routes']:route_lookup[(route['source'],route['target'])]=route
def before(sender,args=None):
    state[:]=[]
    if sender.Document is None:return
    for o in sender.Document.Objects:
        ps=list(o.Params.Input) if isinstance(o,GH.Kernel.IGH_Component) else ([o] if isinstance(o,GH.Kernel.IGH_Param) else [])
        for p in ps:
            state.append((p,p.WireDisplay));p.WireDisplay=GH.Kernel.GH_ParamWireDisplay.hidden
def after(sender,args=None):
    graphics=sender.Graphics;graphics.SmoothingMode=SmoothingMode.AntiAlias
    pen=Pen(Color.FromArgb(170,41,75,141),1.)
    try:
        for p,style in state:
            for source in p.Sources:
                a=source.Attributes.OutputGrip;b=p.Attributes.InputGrip;m=(a.X+b.X)/2
                route=route_lookup.get((str(source.InstanceGuid),str(p.InstanceGuid)))
                if route and abs(a.X-route['a'][0])+abs(a.Y-route['a'][1])+abs(b.X-route['b'][0])+abs(b.Y-route['b'][1])<1e-5:
                    from System import Array
                    graphics.DrawLines(pen,Array[PointF]([PointF(*pt) for pt in route['points']]))
                else:
                    graphics.DrawLine(pen,a,PointF(m,a.Y));graphics.DrawLine(pen,PointF(m,a.Y),PointF(m,b.Y));graphics.DrawLine(pen,PointF(m,b.Y),b)
    finally:
        pen.Dispose()
        for p,style in state:p.WireDisplay=style
        state[:]=[]
cv.CanvasPrePaintWires+=before;cv.CanvasPostPaintWires+=after
sc.sticky[key]=(cv,before,after);cv.Refresh()
print('Straight wire style enabled for the native Grasshopper canvas. Definitions and source connections are unchanged.')
