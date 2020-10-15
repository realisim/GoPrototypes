//-----------------------------------------------------------------------------
/*

|-------------------------------|
|       title                   |
|-------------------------------|
|         legend                |
|-------------------------------|
| y|                            | 
| a|                            | 
| x|        canvas              | 
| i|                            | 
| s|                            | 
|-------------------------------|
|           xAxis               |
|-------------------------------|

*/
const region = {
    rCanvas: 1,
    rTitle: 2,
    rLegend: 3,
    rYAxisMask: 4,
    rXAxisMask: 5,
}

//--- margins
const mAxisLabelMargins = 5;

//--- colors
const cBackground = '#ffffff';
const cMainGridLines = '#9c9c9c';
const cSecondaryGridLines = '#cfcfcf';
const cTitle = '#222222'
const cData = ['#e68a00', '#009900', '#006699', '#6600ff', '#cc0066'];
const cNumberOfDataColors = 5;

//--- fonts
const fAxisFont = "12px Arial";
const fAxisLabelFont = "bold 18px Arial"
const fTitleFont = "bold 22px Arial"
const fLegendFont = "normal 2opt Arial"
    
class ChartCartesian{

    //------------------------------------------------------------------------- 
    constructor(iCanvas, iConfig) {
        this.mCtx = iCanvas.getContext("2d");

        iCanvas.addEventListener("mousedown", this.handleMouseDown.bind(this), false);
        iCanvas.addEventListener("wheel", this.handleWheel.bind(this), false);
        iCanvas.addEventListener("mouseup", this.handleMouseUp.bind(this), false);
        iCanvas.addEventListener("mousemove", this.handleMouseMove.bind(this), false);

        var legendDiv = this.addDivSections(iCanvas);

        //--- config
        this.mTitle = iConfig.data.title;
        this.mLabelAxisX = iConfig.data.labelAxisX;
        this.mLabelAxisY = iConfig.data.labelAxisY;
        this.mDatasets = iConfig.data.datasets;

        // current canvas
        this.mRectangle = new Rectangle();
        this.mRectangle.setCorners(0.0, 0.0, iCanvas.width, iCanvas.height);
        this.mAspectRatio = this.mRectangle.getHeight() / this.mRectangle.getWidth(); 

        // virtual rectangle
        var xVirtualSpace = 100.0;
        var yVirtualSpace = 15000;//xVirtualSpace * this.mAspectRatio;
        this.mOriginalVirtualRectangle = new Rectangle();
        this.mOriginalVirtualRectangle.setCorners(0.0, 0.0, xVirtualSpace, yVirtualSpace);
        
        this.mVirtualRectangle = new Rectangle();
        this.mVirtualRectangle.setCorners(this.mOriginalVirtualRectangle.mX1,
            this.mOriginalVirtualRectangle.mY1,
            this.mOriginalVirtualRectangle.mX2,
            this.mOriginalVirtualRectangle.mY2);

        // properties
        this.mDrag = false;
        this.mZoom = 1.0;
        this.mTranslation = [0.0, 0.0];

        this.mNumberOfMainTicks = 10.0;

        // NiceNumberFunctions - will be defined by the update method
        var mNiceNumberX = undefined;
        var mNiceNumberY = undefined;

        //
        var numDatasets = this.mDatasets.length;
        this.mDatasetVisibility = new Array(numDatasets);
        for(var i = 0; i < numDatasets; i++) {this.mDatasetVisibility[i] = true; }

        this.addLegend(legendDiv);
        this.update();
    }
    
    //-------------------------------------------------------------------------
    addDivSections(iCanvas) {
        var parentDiv = iCanvas.parentElement;

        var canvasDiv = document.createElement("DIV");
        canvasDiv.setAttribute("id", "leftDiv");
        canvasDiv.setAttribute("style", "width: 800px; float: left;");
        parentDiv.appendChild(canvasDiv);

        // reparent canvas to left div
        canvasDiv.appendChild(iCanvas);

        // resize current div to 50%
        //iParentDiv.setAttribute("width", "50%");

        // add a new div.
        var legendDiv = document.createElement("DIV");
        legendDiv.setAttribute("id", "rightDiv");
        legendDiv.setAttribute("style", "margin-left: 820px;");
        parentDiv.appendChild(legendDiv);

        //resize canvas to full parent size, which would be a div section
        iCanvas.width = canvasDiv.offsetWidth;
        iCanvas.height = canvasDiv.offsetHeight;

        return legendDiv;
    }
    //-------------------------------------------------------------------------
    addLegend(iLegendDiv) {
        var numDataset = this.mDatasets.length;

        // add legend content to newly added div.

        var x = undefined;
        for(var i = 0; i < numDataset; i++) {

            // add a checkbox
            x = document.createElement("INPUT");
            x.setAttribute("type", "checkbox");
            x.setAttribute("checked", true);
            x.setAttribute("id", i);
            x.addEventListener("click", this.handleLegendCheckbox.bind(this), false);
            iLegendDiv.appendChild(x);

            // add a little color square
            x = document.createElement("LABEL");
            x.setAttribute("style", "color:" + cData[i%cNumberOfDataColors] + ";font-size:150%;" );
            x.innerHTML = "&#9632";
            iLegendDiv.appendChild(x);

            // add the name of the dataset
            x = document.createElement("LABEL");
            x.setAttribute("for", i)
            x.innerHTML = this.mDatasets[i].label;
            iLegendDiv.appendChild(x);

            x = document.createElement("BR");
            iLegendDiv.appendChild(x);
        }
    }

    //-------------------------------------------------------------------------
    clear() {
        this.mCtx.clearRect( this.mRectangle.mX1, this.mRectangle.mY1, this.mRectangle.getWidth(), this.mRectangle.getHeight() );
    }

    //-------------------------------------------------------------------------
    drawAxis() {
        var tickX = this.mNiceNumberX.getTickSpacing();
        var lbX = this.mNiceNumberX.getNiceLowerBound();
        var ubX = this.mNiceNumberX.getNiceUpperBound();

        var tickY = this.mNiceNumberY.getTickSpacing();
        var lbY = this.mNiceNumberY.getNiceLowerBound();
        var ubY = this.mNiceNumberY.getNiceUpperBound();

        // drawY first, as x will overwrite.
        this.drawAxisY(lbY, ubY, tickY, this.mNumberOfMainTicks);
        this.drawAxisX(lbX, ubX, tickX, this.mNumberOfMainTicks);
        }

    //-------------------------------------------------------------------------
    drawAxisX(iLowerBound, iUpperBound, iTick, iNumberOfTicks) {
        this.mCtx.save();

        this.mCtx.fillStyle = cBackground;

        // drawMask
        var mask = this.getRegion(region.rXAxisMask);
        mask = this.rectangleToPixel(mask);
        this.mCtx.fillRect(mask.mX1, mask.mY1, mask.getWidth(), mask.getHeight());

        // draw numbers
        this.mCtx.textBaseline = 'top'; 
        this.mCtx.textAlign = 'center'; 
        
        this.mCtx.strokeStyle = cMainGridLines;
        this.mCtx.fillStyle = cMainGridLines;
        this.mCtx.font = fAxisFont;
        
        // px margin
        var px = [0, mask.mY1 + mAxisLabelMargins]
        var virtualPos = this.toVirtual(px);

        for(var i = -1; i < (iNumberOfTicks+1); i++){
            virtualPos[0] = iLowerBound + (i*iTick);

            px = this.toPixel(virtualPos);

            var n = virtualPos[0];
            n = this.roundNumberForAxisLabel(n, iTick);
            this.mCtx.fillText( n.toString() , px[0], px[1]);
        }

        // draw axis label
        this.mCtx.font = fAxisLabelFont;
        this.mCtx.textBaseline = 'bottom'; 
        this.mCtx.textAlign = 'center'; 
        px = mask.getCenter();  
        px[1] = mask.mY2 - mAxisLabelMargins;
        this.mCtx.fillText( this.mLabelAxisX , px[0], px[1]);

        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    drawAxisY(iLowerBound, iUpperBound, iTick, iNumberOfTicks) {
        this.mCtx.save();

        this.mCtx.fillStyle = cBackground;

        // drawMask
        var mask = this.getRegion(region.rYAxisMask);
        mask = this.rectangleToPixel(mask);
        this.mCtx.fillRect(mask.mX1, mask.mY1, mask.getWidth(), mask.getHeight());

        // draw numbers
        this.mCtx.textBaseline = 'middle'; 
        this.mCtx.textAlign = 'right'; 
        
        this.mCtx.strokeStyle = cMainGridLines;
        this.mCtx.fillStyle = cMainGridLines;
        this.mCtx.font = fAxisFont;
        
        // px margin
        var px = [mask.mX2 - mAxisLabelMargins, 0]
        var virtualPos = this.toVirtual(px);

        for(var i = -1; i < (iNumberOfTicks+1); i++){
            virtualPos[1] = iLowerBound + (i*iTick);

            px = this.toPixel(virtualPos);

            var n = virtualPos[1];
            n = this.roundNumberForAxisLabel(n, iTick);
            this.mCtx.fillText( n.toString() , px[0], px[1]);
        }

        // draw axis label
        //
        this.mCtx.font = fAxisLabelFont;
        this.mCtx.textBaseline = 'top'; 
        this.mCtx.textAlign = 'center'; 
        px = mask.getCenter();  
        px[0] = mask.mX1 + mAxisLabelMargins;
        this.mCtx.translate(px[0], px[1]);
        this.mCtx.rotate( -Math.PI / 2.0);
        this.mCtx.fillText( this.mLabelAxisY , 0, 0);

        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    drawData() {
        this.mCtx.save();
        this.mCtx.lineWidth = 1.5;

        for(var datasetIndex = 0; datasetIndex < this.mDatasets.length; datasetIndex++){

            if(this.mDatasetVisibility[datasetIndex] == false){
                continue;
            }

            var dataX = this.mDatasets[datasetIndex].dataX;
            var dataY = this.mDatasets[datasetIndex].dataY;
            
            if(dataX.length < 2 || (dataX.length != dataY.length) ){
                console.log("ChartCartesian: drawData invalid data");
                return;
            }

            this.mCtx.strokeStyle = cData[datasetIndex % cNumberOfDataColors];

            this.mCtx.beginPath();

            var px = this.toPixel( [dataX[0], dataY[0] ] );
            this.mCtx.moveTo(px[0], px[1]);
            for(var i = 1; i < dataX.length; i++) {
                px = this.toPixel( [dataX[i], dataY[i] ] );
                this.mCtx.lineTo(px[0], px[1]);
            }
            
            this.mCtx.stroke();
        }

        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    drawGrid() {
        //find the correct x, y tick for the current virtualRectangle
        
        var tickX = this.mNiceNumberX.getTickSpacing();
        var lbX = this.mNiceNumberX.getNiceLowerBound();
        var ubX = this.mNiceNumberX.getNiceUpperBound();

        var tickY = this.mNiceNumberY.getTickSpacing();
        var lbY = this.mNiceNumberY.getNiceLowerBound();
        var ubY = this.mNiceNumberY.getNiceUpperBound();

        //console.log("drawGrid", [tickX, lbX, ubX, tickY, lbY, ubY]);

        this.drawGridX(lbY, ubY, tickY / 5.0, 6.0 * this.mNumberOfMainTicks, cSecondaryGridLines);
        this.drawGridX(lbY, ubY, tickY, this.mNumberOfMainTicks, cMainGridLines);

        this.drawGridY(lbX, ubX, tickX / 5.0, 6.0 * this.mNumberOfMainTicks, cSecondaryGridLines);
        this.drawGridY(lbX, ubX, tickX, this.mNumberOfMainTicks, cMainGridLines);
    }

    //-------------------------------------------------------------------------
    drawGridX(iLowerBound, iUpperBound, iTick, iNumberOfTicks, iColor) {
        
        this.mCtx.save();
        this.mCtx.strokeStyle = iColor;
        
        var lineStart = [this.mVirtualRectangle.mX1, this.mVirtualRectangle.mY1];
        var lineEnd = [this.mVirtualRectangle.mX2, this.mVirtualRectangle.mY1];
        var px = [0, 0]
        for(var i = -1; i < (iNumberOfTicks+1); i++){
            this.mCtx.beginPath();

            lineStart[1] = iLowerBound + (i*iTick);
            lineEnd[1] = iLowerBound + (i*iTick);

            px = this.toPixel(lineStart);
            this.mCtx.moveTo(px[0], px [1]);

            px = this.toPixel(lineEnd);
            this.mCtx.lineTo(px[0], px [1]);
            
            this.mCtx.stroke();
        }

        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    drawGridY(iLowerBound, iUpperBound, iTick, iNumberOfTicks, iColor) {
        this.mCtx.save();
        this.mCtx.strokeStyle = iColor;

        var lineStart = [this.mVirtualRectangle.mX1, this.mVirtualRectangle.mY1];
        var lineEnd = [this.mVirtualRectangle.mX1, this.mVirtualRectangle.mY2];
        var px = [0, 0]
        for(var i = -1; i < (iNumberOfTicks+1); i++){
            this.mCtx.beginPath();

            lineStart[0] = iLowerBound + (i*iTick);
            lineEnd[0] = iLowerBound + (i*iTick);

            px = this.toPixel(lineStart);
            this.mCtx.moveTo(px[0], px [1]);

            px = this.toPixel(lineEnd);
            this.mCtx.lineTo(px[0], px [1]);
            
            this.mCtx.stroke();
        }

        this.mCtx.restore();
    }

    // //-------------------------------------------------------------------------
    // drawLegend() {
    //     this.mCtx.save();
        
    //     var mask = this.getRegion(region.rLegend);
    //     mask = this.rectangleToPixel(mask);

    //     this.mCtx.fillStyle = cBackground;
    //     this.mCtx.fillRect(mask.mX1, mask.mY1, mask.getWidth(), mask.getHeight());

    //     // draw text
    //     this.mCtx.fillStyle = cTitle;
    //     this.mCtx.font = fLegendFont;
    //     this.mCtx.textBaseline = 'top'; 
    //     this.mCtx.textAlign = 'left';

    //     var px = [mask.mX1 + mAxisLabelMargins, mask.mY1 + mAxisLabelMargins];

    //     var numDatasets = this.mDatasets.length;
    //     for(var i = 0; i < numDatasets; i++)
    //     {
    //         this.mCtx.fillText( this.mDatasets[i].label , px[0], px[1]);
    //         px[1] += 10 + mAxisLabelMargins;
    //     }

    //     this.mCtx.restore();
    // }

    //-------------------------------------------------------------------------
    drawTitle() {
        this.mCtx.save();
        
        var mask = this.getRegion(region.rTitle);
        mask = this.rectangleToPixel(mask);

        this.mCtx.fillStyle = cBackground;
        this.mCtx.fillRect(mask.mX1, mask.mY1, mask.getWidth(), mask.getHeight());

        // draw text
        this.mCtx.fillStyle = cTitle;
        this.mCtx.font = fTitleFont;
        this.mCtx.textBaseline = 'middle'; 
        this.mCtx.textAlign = 'center'; 
        var px = mask.getCenter();
        px[1] += mAxisLabelMargins;
        this.mCtx.fillText( this.mTitle , px[0], px[1]);
        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    getRegion(iRegion) {
        var r = new Rectangle();

        switch(iRegion)
        {
            case region.rCanvas: r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, this.mRectangle.mX2, this.mRectangle.mY2); break;
            case region.rTitle:
                {
                    var h = this.mRectangle.getHeight() - 30;
                    r.setCorners(this.mRectangle.mX1, h, 
                        this.mRectangle.mX2, this.mRectangle.mY2);
                }break;
            case region.rLegend:
            {
                var titleR = this.getRegion(region.rTitle);
                var h = titleR.mY1 - 50;
                r.setCorners(this.mRectangle.mX1, h, 
                    this.mRectangle.mX2, titleR.mY1);
            }break;
            case region.rXAxisMask:
                {
                    // as high as the largest text
                    // leave room for the axis label
                    //
                    var ub = "9999"
                    const padding = 2 * mAxisLabelMargins;
                    this.mCtx.font = fAxisFont;
                    var w = this.mCtx.measureText(ub.toString()).width;
                    w *= 2; // room fot the axis label
                    r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, this.mRectangle.mX2, w); 
                }break;
            case region.rYAxisMask:
                {
                    // as wide as the largest text + space for the label
                    var ub = this.mNiceNumberY.getNiceUpperBound();
                    const padding = 2 * mAxisLabelMargins;
                    this.mCtx.font = fAxisFont;
                    ub = this.roundNumberForAxisLabel(ub, this.mNiceNumberY.getTickSpacing());

                    var textSize = this.mCtx.measureText(ub.toString()); 
                    var w = textSize.width;
                    w += padding +  20;

                    r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, w + padding, this.mRectangle.mY2); 
                }break;
            default: break;
        }

        return r;
    }

    //-------------------------------------------------------------------------
    handleLegendCheckbox(iEvent) {
        console.log("clicked on " + iEvent.currentTarget.id )

        var index = parseInt(iEvent.currentTarget.id);
        this.mDatasetVisibility[index] = iEvent.currentTarget.checked
        
        this.update();
    }

    //-------------------------------------------------------------------------
    handleMouseDown(iEvent) {
        console.log("ChartCartesian: mouseDown\n");
        this.mDrag = true;

        this.update();

        return false;
    }

    //-------------------------------------------------------------------------
    handleMouseMove(iEvent) {
        //console.log( "handleMouseMove: %d, %d", iEvent.movementX, iEvent.movementY );

        if(this.mDrag === true) {
            var pixelDelta = [iEvent.movementX, iEvent.movementY];
            var delta = this.toVirtualDelta(pixelDelta);

            this.mTranslation[0] -= delta[0];
            this.mTranslation[1] += delta[1];
        
            this.updateVirualRectangle();
        }
        
        this.update();
    }

    //-------------------------------------------------------------------------
    handleMouseUp(iEvent) {
        console.log("ChartCartesian: mouseUp\n");
        this.mDrag = false;

        this.update();

        
        return false;
    }

    //-------------------------------------------------------------------------
    handleWheel(iEvent) {
        //console.log("ChartCartesian: wheeled %d, zoom: %f\n", iEvent.deltaY, this.mZoom);

        if(iEvent.deltaY > 0)
        {
            this.mZoom *= 1.1;
        }
        else if(iEvent.deltaY < 0)
        {
            this.mZoom /= 1.1;
            this.mZoom = Math.max(this.mZoom, 0.0000001);
        }
        else{}

        this.updateVirualRectangle(iEvent.clientX, iEvent.clientY);
        
        this.update();

        event.preventDefault();
        return false;
    }

    //-------------------------------------------------------------------------  
    // convert a Rectangle to a displayable rectangle in pixel coordinates
    // mostly due to the Y axis inversion
    rectangleToPixel(iRect){
        var r = new Rectangle();
        r.mX1 = iRect.mX1;
        r.mY1 = this.mRectangle.getHeight() - iRect.mY1 - iRect.getHeight();
        r.mX2 = r.mX1 + iRect.getWidth();
        r.mY2 = r.mY1 + iRect.getHeight();
        return r;
    }

    //-------------------------------------------------------------------------
    roundNumberForAxisLabel(iNumber, iTick) {
        var n = iNumber;
        if(iTick < 1.0)
        {
            n = n.toFixed(Math.abs( Math.log10(iTick) - 1 ));
        }
        return n;
    }

    //-------------------------------------------------------------------------
    // since the canvas 0,0 is top left and we want it bottom left, like
    // a math graph, we will invert the Y coordinate here
    //
    toPixel(virtualCoords) {
        var normalizedX = (virtualCoords[0] - this.mVirtualRectangle.mX1) / 
            (this.mVirtualRectangle.mX2 - this.mVirtualRectangle. mX1);
        
        var normalizedY = (virtualCoords[1] - this.mVirtualRectangle.mY1) / 
            (this.mVirtualRectangle.mY2 - this.mVirtualRectangle. mY1);

        var x = normalizedX * this.mRectangle.getWidth();
        var y = normalizedY * this.mRectangle.getHeight();
        
        // substract y to invert the y axis.
        return [x, this.mRectangle.getHeight() - y];
    }

    //-------------------------------------------------------------------------
    toVirtual(iPixelCoords) {
        // invert the y
        iPixelCoords[1] = this.mRectangle.getHeight() - iPixelCoords[1];
        var px = this.toVirtualDelta(iPixelCoords);

        px[0] += this.mVirtualRectangle.mX1;
        px[1] += this.mVirtualRectangle.mY1;
        return px;
    }

    //-------------------------------------------------------------------------
    toVirtualDelta(iPixelCoords) {
        var normalizedX = (iPixelCoords[0] - this.mRectangle.mX1) / 
        (this.mRectangle.mX2 - this.mRectangle. mX1);
    
        var normalizedY = (iPixelCoords[1] - this.mRectangle.mY1) / 
            (this.mRectangle.mY2 - this.mRectangle. mY1);

        var x = normalizedX * this.mVirtualRectangle.getWidth();
        var y = normalizedY * this.mVirtualRectangle.getHeight();
        
        return [x, y];
    }

    //-------------------------------------------------------------------------
    update() {
        this.clear();

        this.mNiceNumberX = new NiceNumber(this.mVirtualRectangle.mX1, this.mVirtualRectangle.mX2, this.mNumberOfMainTicks);
        this.mNiceNumberY = new NiceNumber(this.mVirtualRectangle.mY1, this.mVirtualRectangle.mY2, this.mNumberOfMainTicks * this.mAspectRatio);

        this.drawGrid();
        this.drawData();
        this.drawAxis();

        this.drawTitle();
        //this.drawLegend();
    }

    //-------------------------------------------------------------------------
    updateVirualRectangle(iClientX, iClientY) {

        var previous = this.toVirtual( [iClientX, iClientY] );

        var incX = ((this.mOriginalVirtualRectangle.getWidth() * this.mZoom) - this.mOriginalVirtualRectangle.getWidth()) * 0.5;
        var incY = ((this.mOriginalVirtualRectangle.getHeight() * this.mZoom) - this.mOriginalVirtualRectangle.getHeight()) * 0.5;

        this.mVirtualRectangle.setCorners( 
            this.mTranslation[0] + this.mOriginalVirtualRectangle.mX1 - incX,
            this.mTranslation[1] + this.mOriginalVirtualRectangle.mY1 - incY,
            this.mTranslation[0] + this.mOriginalVirtualRectangle.mX2 + incX,
            this.mTranslation[1] + this.mOriginalVirtualRectangle.mY2 + incY );

        var after = this.toVirtual( [iClientX, iClientY] );

        var delta = [ after[0] - previous[0], after[1] - previous[1] ];
        
        if(iClientX != undefined && iClientY != undefined){
            this.mTranslation[0] -= delta[0];
            this.mTranslation[1] -= delta[1];
            this.updateVirualRectangle();
        }
        
    }
}
