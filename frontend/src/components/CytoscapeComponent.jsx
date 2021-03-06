import React from 'react';
import PropTypes from 'prop-types';
import isEmpty from 'lodash.isempty';
import $ from 'jquery';
import { Container, Row } from 'reactstrap';
import cytoscape from 'cytoscape';
// Extension for zooming user pan
import panzoom from 'cytoscape-panzoom';
// Need to import css for zooming extension
import 'cytoscape-panzoom/cytoscape.js-panzoom.css';
import contextMenus from 'cytoscape-context-menus';
import 'cytoscape-context-menus/cytoscape-context-menus.css';
import edgehandles from 'cytoscape-edgehandles';
import './cytoscapeComponent.css';
import ElementTooltip from './ElementTooltip';
import { PRIORITY, ATTRIBUTE_FORM_OPTIONS as OPTIONS } from '../constants';
import createIdCounter from '../utils/IdCounter';
import DeleteProjectButton from './DeleteProjectButton';

panzoom(cytoscape);
contextMenus(cytoscape, $);
cytoscape.use(edgehandles);

const getCyConfig = (container) => {
  const config = {
    style: [
      {
        selector: 'node',
        css: {
          shape: 'ellipse',
          content: 'data(name)'
        }
      },
      {
        selector: 'edge',
        css: {
          'curve-style': 'bezier',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'target-endpoint': 'outside-to-line',
          'arrow-scale': 1.5
        }
      },
      // some style for the extension
      {
        selector: '.eh-handle',
        style: {
          'background-color': 'red',
          width: 12,
          height: 12,
          shape: 'ellipse',
          'overlay-opacity': 0,
          'border-width': 12, // makes the handle easier to hit
          'border-opacity': 0
        }
      },
      {
        selector: '.eh-hover',
        style: {
          'background-color': 'red'
        }
      },
      {
        selector: '.eh-source',
        style: {
          'border-width': 2,
          'border-color': 'red'
        }
      },
      {
        selector: '.eh-target',
        style: {
          'border-width': 2,
          'border-color': 'red'
        }
      },
      {
        selector: '.eh-preview, .eh-ghost-edge',
        style: {
          'background-color': 'red',
          'line-color': 'red',
          'target-arrow-color': 'red',
          'source-arrow-color': 'red'
        }
      }
    ],
    layout: {
      name: 'grid',
      rows: 1
    }
  };

  return {
    ...config,
    container
  };
};

const zoomDefaults = {
  zoomFactor: 0.05, // zoom factor per zoom tick
  zoomDelay: 45, // how many ms between zoom ticks
  minZoom: 0.1, // min zoom level
  maxZoom: 10, // max zoom level
  fitPadding: 50, // padding when fitting
  panSpeed: 10, // how many ms in between pan ticks
  panDistance: 10, // max pan distance per tick
  // the length of the pan drag box in which the vector for panning is calculated
  // (bigger = finer control of pan speed and direction)
  panDragAreaSize: 75,
  panMinPercentSpeed: 0.25, // the slowest speed we can pan by (as a percent of panSpeed)
  panInactiveArea: 8, // radius of inactive area in pan drag box
  // min opacity of pan indicator (the draggable nib); scales from this to 1.0
  panIndicatorMinOpacity: 0.5,
  // a minimal version of the ui only with zooming (useful on systems with bad mousewheel resolution)
  zoomOnly: false,
  fitSelector: undefined, // selector of elements to fit
  animateOnFit: () => false, // whether to animate on fit
  fitAnimationDuration: 1000, // duration of animation on fit

  // icon class names
  sliderHandleIcon: 'fa fa-minus',
  zoomInIcon: 'fa fa-plus',
  zoomOutIcon: 'fa fa-minus',
  resetIcon: 'fa fa-expand'
};

class CytoscapeComponent extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      selectedElementData: null
    };

    this.handleClick = this.handleClick.bind(this);
    this.showElementInfo = this.showElementInfo.bind(this);
    this.hideElementInfo = this.hideElementInfo.bind(this);
    this.handleExportButtonClick = this.handleExportButtonClick.bind(this);
    this.removeElement = this.removeElement.bind(this);
    this.handleCreateAttributeClick = this.handleCreateAttributeClick.bind(this);
    this.handleAttributeChange = this.handleAttributeChange.bind(this);
    this.handleDeleteAttributeClick = this.handleDeleteAttributeClick.bind(this);
    this.deleteActiveProject = this.deleteActiveProject.bind(this);
    this.validateName = this.validateName.bind(this);
  }

  componentDidMount() {
    const { project } = this.props;
    const { graph } = project;
    this.counter = createIdCounter();
    this.initialize(graph, this.editorContainer);
  }

  componentDidUpdate(prevProps) {
    const { project } = this.props;
    // Re-render cytoscape container only in case if graph has been changed
    if (project !== prevProps.project) {
      const { graph } = project;
      this.counter.reset();
      if (isEmpty(graph)) {
        // Clear the elements in graph, leave the config
        this.cy.json({ elements: {} });
      } else {
        // Override the config
        this.cy.json(graph);
      }
    }
  }

  initialize(graph, container) {
    const cyConfig = getCyConfig(container);
    const cy = cytoscape(cyConfig);
    this.panzoom = cy.panzoom(zoomDefaults);
    this.menu = cy.contextMenus(this.getContextMenuConfig());
    this.edgeHandles = cy.edgehandles(this.getEdgehandlesConfig(this.counter, cy));
    cy.on('click', this.handleClick);
    cy.json(graph);
    this.cy = cy;
    // TODO: find out why this doesn't work for normal config
    this.cy
      .style()
      .selector('edge')
      .style({ label: 'data(name)' })
      .selector(`*:unselected[priority = '${PRIORITY.LOW}']`)
      .style({ 'background-color': '#69d052', 'line-color': '#69d052' })
      .selector(`*:unselected[priority = '${PRIORITY.MEDIUM}']`)
      .style({ 'background-color': '#ffc905', 'line-color': '#ffc905' })
      .selector(`*:unselected[priority = '${PRIORITY.HIGH}']`)
      .style({ 'background-color': '#ff4545', 'line-color': '#ff4545' })
      .update();
    this.cy.userZoomingEnabled(false);
  }

  componentWillUnmount() {
    this.menu.destroy();
    this.cy.removeListener('click', this.handleClick);
    this.cy.destroy();
  }

  getContextMenuConfig() {
    const selectAllOfTheSameType = (ele) => {
      this.cy.elements().unselect();
      if (ele === 'node') {
        this.cy.nodes().select();
      } else if (ele === 'edge') {
        this.cy.edges().select();
      }
    };

    const selectAll = () => {
      this.cy.elements('*').select();
    };

    const menuOptions = {
      // List of initial menu items
      menuItems: [
        {
          id: 'add-node',
          content: 'Add node',
          tooltipText: 'add node',
          // image: {
          //   src: 'add.svg', width: 12, height: 12, x: 6, y: 4,
          // },
          coreAsWell: true,
          onClickFunction: (event) => {
            this.createNode(event.position.x, event.position.y);
          },
          hasTrailingDivider: true
        },
        {
          id: 'remove', // ID of menu item
          content: 'Remove', // Display content of menu item
          tooltipText: 'remove', // Tooltip text for menu item
          // image: {
          //   src: 'remove.svg',
          //   width: 12,
          //   height: 12,
          //   x: 6,
          //   y: 4,
          // }, // menu icon
          // Filters the elements to have this menu item on cxttap
          // If the selector is not truthy no elements will have this menu item on cxttap
          selector: 'node, edge',
          onClickFunction: (event) => {
            // The function to be executed on click
            this.removeElement(event.target);
          },
          disabled: false, // Whether the item will be created as disabled
          show: true, // Whether the item will be shown or not
          hasTrailingDivider: true, // Whether the item will have a trailing divider
          coreAsWell: false // Whether core instance have this item on cxttap
        },
        {
          id: 'remove-all-selected',
          content: 'Remove all selected',
          tooltip: 'remove all selected',
          onClickFunction: () => {
            this.cy.$(':selected').remove();
          },
          disabled: false,
          show: true,
          hasTrailingDivider: false,
          coreAsWell: true
        },
        {
          id: 'select-all',
          content: 'Select all',
          tooltipText: 'select all',
          onClickFunction: () => {
            selectAll();
          },
          hasTrailingDivider: false,
          show: true,
          coreAsWell: true
        },
        {
          id: 'select-all-nodes',
          content: 'Select all nodes',
          tooltipText: 'select all nodes',
          onClickFunction: () => {
            selectAllOfTheSameType('node');
          },
          hasTrailingDivider: false,
          show: true,
          coreAsWell: true
        },
        {
          id: 'select-all-edges',
          content: 'Select all edges',
          tooltipText: 'select all edges',
          onClickFunction: () => {
            selectAllOfTheSameType('edge');
          },
          hasTrailingDivider: true,
          show: true,
          coreAsWell: true
        }
      ],
      // css classes that menu items will have
      menuItemClasses: [
        // add class names to this list
      ],
      // css classes that context menu will have
      contextMenuClasses: [
        // add class names to this list
      ]
    };

    return menuOptions;
  }

  getEdgehandlesConfig(counter, cy) {
    // the default values of each option are outlined below:
    const defaults = {
      preview: true, // whether to show added edges preview before releasing selection
      hoverDelay: 150, // time spent hovering over a target node before it is considered selected
      handleNodes: 'node', // selector/filter function for whether edges can be made from a given node
      handlePosition(node) {
        return 'middle top'; // sets the position of the handle in the format of "X-AXIS Y-AXIS" such as "left top", "middle top"
      },
      handleInDrawMode: false, // whether to show the handle in draw mode
      edgeType(sourceNode, targetNode) {
        // can return 'flat' for flat edges between nodes or 'node' for intermediate node between them
        // returning null/undefined means an edge can't be added between the two nodes
        return 'flat';
      },
      loopAllowed(node) {
        // for the specified node, return whether edges from itself to itself are allowed
        return false;
      },
      nodeLoopOffset: -50, // offset for edgeType: 'node' loops
      nodeParams(sourceNode, targetNode) {
        // for edges between the specified source and target
        // return element object to be passed to cy.add() for intermediary node
        return {};
      },
      edgeParams(sourceNode, targetNode, i) {
        // for edges between the specified source and target
        // return element object to be passed to cy.add() for edge
        // NB: i indicates edge index in case of edgeType: 'node'
        return {
          group: 'edges',
          data: {
            source: sourceNode.id(),
            target: targetNode.id(),
            from: sourceNode.data('name'),
            to: targetNode.data('name'),
            priority: PRIORITY.LOW
          }
        };
      },
      show(sourceNode) {
        // fired when handle is shown
      },
      hide(sourceNode) {
        // fired when the handle is hidden
      },
      start(sourceNode) {
        // fired when edgehandles interaction starts (drag on handle)
      },
      complete(sourceNode, targetNode, addedEles) {
        // fired when edgehandles is done and elements are added
        let name = counter.nextNumber();
        const isNameValid = (cy, edgeName) => {
          const result = cy.filter(`[name = "${edgeName}"]`);
          return result.size() === 0;
        };
        while (!isNameValid(cy, name)) {
          name = counter.nextNumber();
        }
        addedEles.data('name', name);
      },
      stop(sourceNode) {
        // fired when edgehandles interaction is stopped (either complete with added edges or incomplete)
      },
      cancel(sourceNode, cancelledTargets) {
        // fired when edgehandles are cancelled (incomplete gesture)
      },
      hoverover(sourceNode, targetNode) {
        // fired when a target is hovered
      },
      hoverout(sourceNode, targetNode) {
        // fired when a target isn't hovered anymore
      },
      previewon(sourceNode, targetNode, previewEles) {
        // fired when preview is shown
      },
      previewoff(sourceNode, targetNode, previewEles) {
        // fired when preview is hidden
      },
      drawon() {
        // fired when draw mode enabled
      },
      drawoff() {
        // fired when draw mode disabled
      }
    };

    return defaults;
  }

  isNameValid(elementName) {
    return this.cy.filter(`[name = "${elementName}"]`).size() === 0;
  }

  createNode(x, y) {
    let name = this.counter.nextLetter();
    while (!this.isNameValid(name)) {
      name = this.counter.nextLetter();
    }

    this.cy.add({
      group: 'nodes',
      data: {
        name,
        priority: PRIORITY.LOW
      },
      position: { x, y }
    });
  }

  removeElement(element) {
    this.cy.remove(element);
  }

  showElementInfo(element) {
    this.setState({ selectedElementData: element.data() });
  }

  hideElementInfo() {
    const { selectedElementData } = this.state;

    if (selectedElementData != null) {
      this.setState({ selectedElementData: null });
    }
  }

  handleClick(event) {
    const element = event.target;
    if (element === this.cy) {
      this.hideElementInfo();
    } else {
      this.showElementInfo(element);
    }
  }

  handleAttributeChange(key, value) {
    const { selectedElementData } = this.state;
    const { id } = selectedElementData;
    const targetElement = this.cy.getElementById(id);
    targetElement.data(key, value);
    // Update all edges if node name changes
    if (targetElement.isNode() && key === OPTIONS.NAME) {
      targetElement.outgoers('edge').forEach(outEdge => outEdge.data(OPTIONS.FROM, value));
      targetElement.incomers('edge').forEach(inEdge => inEdge.data(OPTIONS.TO, value));
    }
    this.setState(prevState => ({
      selectedElementData: { ...prevState.selectedElementData, [key]: value }
    }));
  }

  validateName(name) {
    const elements = this.cy.elements(
      `node[${OPTIONS.NAME} = "${name}"], edge[${OPTIONS.NAME} = "${name}"]`
    );

    return elements.size() === 0;
  }

  handleDeleteAttributeClick(attributeName) {
    const { selectedElementData } = this.state;
    const { id } = selectedElementData;
    const selectedElement = this.cy.getElementById(id);
    return () => {
      selectedElement.removeData(attributeName);
      this.setState({ selectedElementData: selectedElement.data() });
    };
  }

  handleCreateAttributeClick(name, value) {
    const { selectedElementData } = this.state;
    const { id } = selectedElementData;
    const selectedElement = this.cy.getElementById(id);
    selectedElement.data(name, value);
    this.setState(prevState => ({
      selectedElementData: { ...prevState.selectedElementData, [name]: value }
    }));
  }

  handleExportButtonClick() {
    console.log(this.cy.json());
  }

  saveProject() {
    const { project, onProjectSave } = this.props;
    const { id } = project;
    // Hide edgehandles ('red dots') before saving
    this.edgeHandles.hide();
    const graph = this.cy.json();
    onProjectSave(id, graph);
  }

  deleteActiveProject() {
    const { project, onProjectDelete } = this.props;
    const { id } = project;
    onProjectDelete(id);
  }

  render() {
    const { selectedElementData } = this.state;
    return (
      <Container fluid>
        <Row>
          <div className="cytoscape-container" ref={ref => (this.editorContainer = ref)} />
          {selectedElementData && (
            <ElementTooltip
              onAttributeChange={this.handleAttributeChange}
              validateName={this.validateName}
              onDeleteAttributeClick={this.handleDeleteAttributeClick}
              onCreateAttributeClick={this.handleCreateAttributeClick}
              elementAttributes={selectedElementData}
            />
          )}
        </Row>
        <Row>
          <div className="cytoscape-footer">
            <button type="button" onClick={this.handleExportButtonClick}>
              Export as JSON
            </button>
            <DeleteProjectButton onClick={this.deleteActiveProject} />
          </div>
        </Row>
      </Container>
    );
  }
}

CytoscapeComponent.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.string.isRequired,
    graph: PropTypes.object.isRequired
  }).isRequired,
  onProjectSave: PropTypes.func.isRequired,
  onProjectDelete: PropTypes.func.isRequired
};

export default CytoscapeComponent;
