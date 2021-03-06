require([
  "esri/Map",
  "esri/layers/FeatureLayer",
  "esri/views/MapView",
  "esri/core/promiseUtils",
  "esri/widgets/Legend",
  "esri/widgets/Home",
  "esri/widgets/Slider",
  "esri/widgets/Fullscreen"
], (Map, FeatureLayer, MapView, promiseUtils, Legend, Home, Slider, Fullscreen) => {
  //--------------------------------------------------------------------------
  //
  //  Setup Map and View
  //
  //--------------------------------------------------------------------------

  const layer = new FeatureLayer({
    portalItem: {
      id: "f63c62e9ad494227869d069ed945cc6c"
    },
    definitionExpression: "CNSTRCT_YR > 0",
    title: "Building Footprints",
    effect: "bloom(1.5 0 0.5)"
  });

  const map = new Map({
    basemap: {
      portalItem: {
        id: "4f2e99ba65e34bb8af49733d9778fb8e"
      }
    },
    layers: [layer]
  });

  const view = new MapView({
    map: map,
    container: "viewDiv",
    center: [168.77171711, -45.00641535],
    zoom: 7,
    constraints: {
      snapToZoom: false,
      minScale: 150000
    },
    // This ensures that when going fullscreen
    // The top left corner of the view extent
    // stays aligned with the top left corner
    // of the view's container
    resizeAlign: "top-left"
  });

  //--------------------------------------------------------------------------
  //
  //  Setup UI
  //
  //--------------------------------------------------------------------------

  const applicationDiv = document.getElementById("applicationDiv");
  const sliderValue = document.getElementById("sliderValue");
  const playButton = document.getElementById("playButton");
  const titleDiv = document.getElementById("titleDiv");
  let animation = null;

  const slider = new Slider({
    container: "slider",
    min: 1871,
    max: 2022,
    values: [ 1871 ],
    step: 1,
    visibleElements: {
      rangeLabels: true
    }
  });

  // When user drags the slider:
  //  - stops the animation
  //  - set the visualized year to the slider one.
  function inputHandler(event) {
    stopAnimation();
    setYear(event.value);
  }
  slider.on("thumb-drag", inputHandler);

  // Toggle animation on/off when user
  // clicks on the play button
  playButton.addEventListener("click", () => {
    if (playButton.classList.contains("toggled")) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  view.ui.empty("top-left");
  // Putting the title into the top left of the interface
  view.ui.add(titleDiv, "top-left");

  // Home button to top left of UI
  view.ui.add(
    new Home({
      view: view
    }),
    "top-left"
  );

  // Legend to bottom left of UI
  view.ui.add(
    new Legend({
      view: view
    }),
    "bottom-left"
  );

  // Adding fullscreen button to top left of UI
  view.ui.add(
    new Fullscreen({
      view: view,
      element: applicationDiv
    }),
    "top-right"
  );

  // When the layerview is available, setup hovering interactivity
  view.whenLayerView(layer).then(setupHoverTooltip);

  // Starts the application by visualizing year 1984
  setYear(1871);

  //--------------------------------------------------------------------------
  //
  //  Methods
  //
  //--------------------------------------------------------------------------

  /**
   * Sets the current visualized construction year.
   */
  function setYear(value) {
    sliderValue.innerHTML = Math.floor(value);
    slider.viewModel.setValue(0, value);
    layer.renderer = createRenderer(value);
  }

  /**
   * Returns a renderer with a color visual variable driven by the input
   * year. The selected year will always render buildings built in that year
   * with a light blue color. Buildings built 20+ years before the indicated
   * year are visualized with a pink color. Buildings built within that
   * 20-year time frame are assigned a color interpolated between blue and pink.
   */
  function createRenderer(year) {
    const opacityStops = [
      {
        opacity: 1,
        value: year
      },
      {
        opacity: 0,
        value: year + 1
      }
    ];

    return {
      type: "simple",
      symbol: {
        type: "simple-fill",
        color: "rgb(0, 0, 0)",
        outline: null
      },
      visualVariables: [
        {
          type: "opacity",
          field: "CNSTRCT_YR",
          stops: opacityStops,
          legendOptions: {
            showLegend: false
          }
        },
        {
          type: "color",
          field: "CNSTRCT_YR",
          legendOptions: {
            title: "Titled:"
          },
          stops: [
            {
              value: year,
              color: "#e7ed8a",
              label: "in " + Math.floor(year)
            },
            {
              value: year - 10,
              color: "#eaed13",
              label: "in " + (Math.floor(year) - 10)
            },
            {
              value: year - 20,
              color: "#007af4",
              label: "before " + (Math.floor(year) - 20)
            }
          ]
        }
      ]
    };
  }

  /**
   * Sets up a moving tooltip that displays
   * the construction year of the hovered building.
   */
  function setupHoverTooltip(layerview) {
    let highlight;

    const tooltip = createTooltip();

    const hitTest = promiseUtils.debounce((event) => {
      return view.hitTest(event)
        .then((hit) => {
          const results = hit.results.filter((result) => {
            return result.graphic.layer === layer;
          });

          if (!results.length) {
            return null;
          }

          return {
            graphic: results[0].graphic,
            screenPoint: hit.screenPoint
          };
        });
    });

    view.on("pointer-move", (event) => {
      return hitTest(event)
        .then((hit) => {
          // remove current highlighted feature
          if (highlight) {
            highlight.remove();
            highlight = null;
          }

          // highlight the hovered feature
          // or hide the tooltip
          if (hit) {
            const graphic = hit.graphic;
            const screenPoint = hit.screenPoint;

            highlight = layerview.highlight(graphic);
            tooltip.show(screenPoint, "Titled in " + graphic.getAttribute("CNSTRCT_YR"));
          } else {
            tooltip.hide();
          }
        }, () => {});
    });
  }

  /**
   * Starts the animation that cycle
   * through the construction years.
   */
  function startAnimation() {
    stopAnimation();
    animation = animate(slider.values[0]);
    playButton.classList.add("toggled");
  }

  /**
   * Stops the animations
   */
  function stopAnimation() {
    if (!animation) {
      return;
    }

    animation.remove();
    animation = null;
    playButton.classList.remove("toggled");
  }

  /**
   * Animates the color visual variable continously
   */
  function animate(startValue) {
    let animating = true;
    let value = startValue;

    const frame = (timestamp) => {
      if (!animating) {
        return;
      }

      value += 0.5;
      if (value > 2017) {
        value = 1880;
      }

      setYear(value);

      // Update at 10fps
      setTimeout(() => {
        requestAnimationFrame(frame);
      }, 1000 / 7);
    };

    frame();

    return {
      remove: () => {
        animating = false;
      }
    };
  }

  /**
   * Creates a tooltip to display a the construction year of a building.
   */
  function createTooltip() {
    const tooltip = document.createElement("div");
    const style = tooltip.style;

    tooltip.setAttribute("role", "tooltip");
    tooltip.classList.add("tooltip");

    const textElement = document.createElement("div");
    textElement.classList.add("esri-widget");
    tooltip.appendChild(textElement);

    view.container.appendChild(tooltip);

    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;
    let visible = false;

    // move the tooltip progressively
    function move() {
      x += (targetX - x) * 0.1;
      y += (targetY - y) * 0.1;

      if (Math.abs(targetX - x) < 1 && Math.abs(targetY - y) < 1) {
        x = targetX;
        y = targetY;
      } else {
        requestAnimationFrame(move);
      }

      style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px, 0)";
    }

    return {
      show: (point, text) => {
        if (!visible) {
          x = point.x;
          y = point.y;
        }

        targetX = point.x;
        targetY = point.y;
        style.opacity = 1;
        visible = true;
        textElement.innerHTML = text;

        move();
      },

      hide: () => {
        style.opacity = 0;
        visible = false;
      }
    };
  }
});