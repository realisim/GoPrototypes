

const region = {
    rCanvas: 1,
    rYAxisMask: 2,
    rXAxisMask: 3,
}

//--- margins
const mAxisLabelMargins = 5;

//--- colors
const cBackground = '#ffffff';
const cMainGridLines = '#9c9c9c';
const cData = ['#e68a00', '#009900', '#006699', '#6600ff', '#cc0066'];
const cNumberOfDataColors = 5;

//--- fonts
const fAxisFont = "12px Arial";
    
class ChartCartesian{

    //------------------------------------------------------------------------- 
    constructor(iCanvas, iConfig) {
        this.mCtx = iCanvas.getContext("2d");

        iCanvas.addEventListener("mousedown", this.handleMouseDown.bind(this), false);
        iCanvas.addEventListener("wheel", this.handleWheel.bind(this), false);
        iCanvas.addEventListener("mouseup", this.handleMouseUp.bind(this), false);
        iCanvas.addEventListener("mousemove", this.handleMouseMove.bind(this), false);

        //resize canvas to full parent size, which would be a div section
        iCanvas.width = iCanvas.parentElement.offsetWidth
        iCanvas.height = iCanvas.parentElement.offsetHeight

        //this.mCtx.font = "30px Arial";
        //this.mCtx.fillText(iConfig.data.labels, 10, 50);

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

        this.update();
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
        this.mCtx.textBaseline = 'bottom'; 
        this.mCtx.textAlign = 'center'; 
        
        this.mCtx.strokeStyle = cMainGridLines;
        this.mCtx.fillStyle = cMainGridLines;
        this.mCtx.font = fAxisFont;
        
        // px margin
        var px = [0, mAxisLabelMargins]
        var virtualPos = this.toVirtual(px);

        for(var i = -1; i < (iNumberOfTicks+1); i++){
            virtualPos[0] = iLowerBound + (i*iTick);

            px = this.toPixel(virtualPos);

            var n = virtualPos[0];
            n = this.roundNumberForAxisLabel(n, iTick);
            this.mCtx.fillText( n.toString() , px[0], px[1]);
        }

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
        this.mCtx.textAlign = 'left'; 
        
        this.mCtx.strokeStyle = cMainGridLines;
        this.mCtx.fillStyle = cMainGridLines;
        this.mCtx.font = fAxisFont;
        
        // px margin
        var px = [mAxisLabelMargins, 0]
        var virtualPos = this.toVirtual(px);

        for(var i = -1; i < (iNumberOfTicks+1); i++){
            virtualPos[1] = iLowerBound + (i*iTick);

            px = this.toPixel(virtualPos);

            var n = virtualPos[1];
            n = this.roundNumberForAxisLabel(n, iTick);
            this.mCtx.fillText( n.toString() , px[0], px[1]);
        }

        this.mCtx.restore();
    }

    //-------------------------------------------------------------------------
    drawData() {
        this.mCtx.save();
        this.mCtx.lineWidth = 1.5;

        for(var datasetIndex = 0; datasetIndex < this.mDatasets.length; datasetIndex++){

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

        this.drawGridX(lbY, ubY, tickY, this.mNumberOfMainTicks);
        this.drawGridY(lbX, ubX, tickX, this.mNumberOfMainTicks);
    }

    //-------------------------------------------------------------------------
    drawGridX(iLowerBound, iUpperBound, iTick, iNumberOfTicks) {
        
        this.mCtx.save();
        this.mCtx.strokeStyle = cMainGridLines;
        
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
    drawGridY(iLowerBound, iUpperBound, iTick, iNumberOfTicks) {
        this.mCtx.save();
        this.mCtx.strokeStyle = cMainGridLines;

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

    //-------------------------------------------------------------------------
    getRegion(iRegion) {
        var r = new Rectangle();

        switch(iRegion)
        {
            case region.rCanvas: r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, this.mRectangle.mX2, this.mRectangle.mY2); break;
            case region.rXAxisMask:
                // as high as the largest text
                var ub = 0.0
                r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, this.mRectangle.mX2, 30); 
            break;
            case region.rYAxisMask:
                // as wide as the largest text
                var ub = this.mNiceNumberX.getNiceUpperBound();
                const padding = 2 * mAxisLabelMargins;
                this.mCtx.font = fAxisFont;
                ub = this.roundNumberForAxisLabel(ub, this.mNiceNumberX.getTickSpacing())
                var w = this.mCtx.measureText(ub.toString()).width;
                r.setCorners(this.mRectangle.mX1, this.mRectangle.mY1, w + padding, this.mRectangle.mY2); 
            break;
            default: break;
        }

        return r;
    }

    //-------------------------------------------------------------------------
    handleMouseDown(iEvent) {
        console.log("ChartCartesian: mouseDown\n");
        this.mDrag = true;

        this.update();
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
        var px = this.toVirtualDelta(iPixelCoords);

        // substract y to invert the y axis.
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
        
        // substract y to invert the y axis.
        return [x, y];
    }

    //-------------------------------------------------------------------------
    update() {
        this.clear();

        this.mNiceNumberX = new NiceNumber(this.mVirtualRectangle.mX1, this.mVirtualRectangle.mX2, this.mNumberOfMainTicks);
        this.mNiceNumberY = new NiceNumber(this.mVirtualRectangle.mY1, this.mVirtualRectangle.mY2, this.mNumberOfMainTicks * this.mAspectRatio);

        //this.DrawTitle();
        this.drawGrid();
        this.drawData();
        this.drawAxis();
        //this.DrawLegend();
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
            this.mTranslation[1] += delta[1];
            this.updateVirualRectangle();
        }
        
    }
}
