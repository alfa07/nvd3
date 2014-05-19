var LinePlusBarChartPrivates = {
    tooltips : true
    , state : null
    , defaultState : null
    , xScale: null
    , yScale1: null
    , yScale2 : null
    , y1Axis: null
    , y2Axis: null
    , color: nv.utils.defaultColor()
};

/**
 * A LinePlusBarChart
 */
function LinePlusBarChart(options){
    options = nv.utils.extend({}, options, LinePlusBarChartPrivates, {
        margin : {top: 30, right: 60, bottom: 50, left: 60}
        , chartClass: 'linePlusBar'
    });
    Chart.call(this, options);

    this.line = this.getLine();
    this.historicalBar = this.getHistoricalBar();
    this.y1Axis(this.getAxis());
    this.y2Axis(this.getAxis());

    this.xAxis
        .tickPadding(7)
    ;
    this.historicalBar
        .padData(true)
    ;
    this.line
        .clipEdge(false)
        .padData(true)
    ;
    this.y1Axis()
        .orient('left')
    ;
    this.y2Axis()
        .orient('right')
    ;
    this.showTooltip = function(e, offsetElement) {
        var left = e.pos[0] + ( offsetElement.offsetLeft || 0 ),
            top = e.pos[1] + ( offsetElement.offsetTop || 0),
            x = this.xAxis.tickFormat()(this.line.x()(e.point, e.pointIndex)),
            y = (e.series.bar ? this.y1Axis() : this.y2Axis()).tickFormat()(this.line.y()(e.point, e.pointIndex)),
            content = this.tooltip()(e.series.key, x, y);

        nv.tooltip.show([left, top], content, e.value < 0 ? 'n' : 's', null, offsetElement);
    }.bind(this);
}

nv.utils.create(LinePlusBarChart, Chart, LinePlusBarChartPrivates);

LinePlusBarChart.prototype.getLine = function(){
    return nv.models.line();
};

LinePlusBarChart.prototype.getHistoricalBar = function(){
    return nv.models.historicalBar();
};

LinePlusBarChart.prototype.wrapper = function(data){
    Chart.prototype.wrapper.call(this, data,
        ['nv-y1 nv-axis', 'nv-y2 nv-axis', 'nv-barsWrap', 'nv-linesWrap']
    );
};

LinePlusBarChart.prototype.draw = function(data){
    var that = this
        , availableWidth = this.available.width
        , availableHeight = this.available.height
        , dataBars = data.filter(function(d) { return !d.disabled && d.bar })
        , dataLines = data.filter(function(d) { return !d.bar }) // removed the !d.disabled clause here to fix Issue #240
        , barsWrap = this.g.select('.nv-barsWrap').datum(dataBars.length ? dataBars : [{values:[]}])
        , linesWrap = this.g.select('.nv-linesWrap').datum(dataLines[0] && !dataLines[0].disabled ? dataLines : [{values:[]}] )
        ;

    this.line
        .margin({top: 0, right: 0 , bottom: 0, left: 0})
        .width(availableWidth)
        .height(availableHeight)
        .color(data.map(function(d,i) {
            return d.color || that.color()(d, i);
        }).filter(function(d,i) { return !data[i].disabled && !data[i].bar }));

    this.historicalBar
        .margin({top: 0, right: 0 , bottom: 0, left: 0})
        .width(availableWidth)
        .height(availableHeight)
        .color(data.map(function(d,i) {
            return d.color || that.color()(d, i);
        }).filter(function(d,i) { return !data[i].disabled && data[i].bar }));

    d3.transition(barsWrap).call(this.historicalBar);
    d3.transition(linesWrap).call(this.line);

    this.xScale(
        dataLines.filter(function(d) { return !d.disabled; }).length && dataLines.filter(function(d) { return !d.disabled; })[0].values.length
            ? this.line.xScale()
            : this.historicalBar.xScale()
    );
    this.yScale1(this.historicalBar.yScale());
    this.yScale2(this.line.yScale());

    this.xAxis
        .scale(this.xScale())
        .ticks( availableWidth / 100 )
        .tickSize(-availableHeight, 0);

    this.y1Axis()
        .scale(this.yScale1())
        .ticks( availableHeight / 36 )
        .tickSize(-availableWidth, 0);

    this.y2Axis()
        .scale(this.yScale2())
        .ticks( availableHeight / 36 )
        .tickSize(dataBars.length ? 0 : -availableWidth, 0); // Show the y2 rules only if y1 has none

    this.g.select('.nv-x.nv-axis')
        .attr('transform', 'translate(0,' + this.yScale1().range()[0] + ')');

    this.g.select('.nv-y2.nv-axis')
        .style('opacity', dataLines.length ? 1 : 0)
        .attr('transform', 'translate(' + availableWidth + ',0)');
    //.attr('transform', 'translate(' + x.range()[1] + ',0)');

    d3.transition(this.g.select('.nv-x.nv-axis'))
        .call(this.xAxis);
    d3.transition(this.g.select('.nv-y1.nv-axis'))
        .style('opacity', dataBars.length ? 1 : 0)
        .call(this.y1Axis());
    d3.transition(this.g.select('.nv-y2.nv-axis'))
        .call(this.y2Axis());

};

LinePlusBarChart.prototype.attachEvents = function(){
    Chart.prototype.attachEvents.call(this);
    var that = this;
    this.dispatch
        .on('tooltipShow', function(e) {
            if (this.tooltips) this.showTooltip(e, this.svg[0][0].parentNode);
        }.bind(this))
        // Update chart from a state object passed to event handler
        .on('changeState', function(e) {
            if (typeof e.disabled !== 'undefined') {
                that.svg.call(function(selection){
                    selection.each(function(data){
                        data.forEach(function(series,i) {
                            series.disabled = e.disabled[i];
                        });
                        that.state.disabled = e.disabled;
                    });
                });
            }
            this.update();
        }.bind(this))
        .on('tooltipHide', function() {
            if (this.tooltips) nv.tooltip.cleanup();
        }.bind(this));

    this.legend.dispatch.on('stateChange', function(newState) {
        this.state = newState;
        this.dispatch.stateChange(this.state);
        this.update();
    }.bind(this));

    this.line
        .dispatch.on('elementMouseover.tooltip', function(e) {
            e.pos = [e.pos[0] +  this.margin().left, e.pos[1] + this.margin().top];
            this.dispatch.tooltipShow(e);
        }.bind(this))
        .on('elementMouseout.tooltip', function(e) {
            this.dispatch.tooltipHide(e);
        }.bind(this));

    this.historicalBar
        .dispatch.on('elementMouseover.tooltip', function(e) {
            e.pos = [e.pos[0] + this.margin().left, e.pos[1] + this.margin().top];
            this.dispatch.tooltipShow(e);
        }.bind(this))
        .on('elementMouseout.tooltip', function(e) {
            this.dispatch.tooltipHide(e);
        }.bind(this));

};

LinePlusBarChart.prototype.x = function(_) {
    if (!arguments.length) return this.xScale();
    this.xScale(_);
    this.line.x(_);
    this.historicalBar.x(_);
    return this;
};

LinePlusBarChart.prototype.color = function(_) {
    if (!arguments.length) return this.options.color;
    this.options.color = nv.utils.getColor(_);
    this.legend.color(_);
    return this;
};

LinePlusBarChart.prototype.tooltipContent = function(_) {
    if (!arguments.length) return this.tooltip();
    this.tooltip(_);
    return this;
};

nv.models.linePlusBarChart = function() {
    "use strict";

    var linePlusBarChart = new LinePlusBarChart();

    function chart(selection) {
        linePlusBarChart.render(selection);
        return chart;
    }
    chart.dispatch = linePlusBarChart.dispatch;
    chart.legend = linePlusBarChart.legend;
    chart.line = linePlusBarChart.line;
    chart.bars = linePlusBarChart.historicalBar;
    chart.y1Axis = linePlusBarChart.y1Axis();
    chart.y2Axis = linePlusBarChart.y2Axis();

    d3.rebind(chart, linePlusBarChart.line, 'defined', 'size', 'clipVoronoi', 'interpolate');
    d3.rebind(chart, linePlusBarChart.historicalBar, 'forceY');

    chart.options = nv.utils.optionsFunc.bind(chart);

    nv.utils.rebindp(chart, linePlusBarChart, LinePlusBarChart.prototype,
        'x', 'margin', 'width', 'height', 'color', 'showLegend', 'tooltips', 'tooltipContent', 'state',
        'defaultState', 'noData', 'xAxis'
    );

    return chart;
};
