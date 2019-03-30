import { projectService } from '../services';
import { projectActionTypes } from '../const';
import { modalActions } from './modal.actions';

const {
  FETCH_PROJECT_LIST,
  FETCH_PROJECT,
  CREATE_PROJECT,
  UPDATE_PROJECT,
  DELETE_PROJECT
} = projectActionTypes;

export const projectActions = {
  fetchProjectList,
  fetchProject,
  createProject,
  updateProject,
  deleteProject
};

function fetchProjectList() {
  return (dispatch) => {
    dispatch(request(FETCH_PROJECT_LIST));

    projectService.fetchProjectList().then(
      projects => dispatch({
        type: FETCH_PROJECT_LIST,
        projects
      }),
      errMessage => dispatch(error(FETCH_PROJECT_LIST, { errMessage }))
    );
  };
}

function fetchProject(projectId) {
  return (dispatch) => {
    dispatch(request(FETCH_PROJECT));

    projectService.fetchProject(projectId).then(
      project => dispatch({
        type: FETCH_PROJECT,
        project
      }),
      errMessage => dispatch(error(FETCH_PROJECT, { errMessage }))
    );
  };
}

function createProject(newProject) {
  return (dispatch) => {
    dispatch(request(CREATE_PROJECT));

    projectService.createProject(newProject).then(
      (project) => {
        dispatch({
          type: CREATE_PROJECT,
          project
        });
        dispatch(modalActions.hideModal());
      },
      errMessage => dispatch(error(CREATE_PROJECT, { errMessage }))
    );
  };
}

function updateProject(updatedProject) {
  return (dispatch) => {
    dispatch(request(UPDATE_PROJECT));

    projectService.updateProject(updatedProject).then(
      (project) => {
        dispatch({
          type: UPDATE_PROJECT,
          project
        });
        dispatch(modalActions.hideModal());
      },
      errMessage => dispatch(error(UPDATE_PROJECT, { errMessage }))
    );
  };
}

function deleteProject(id) {
  return (dispatch) => {
    dispatch(request(DELETE_PROJECT));

    projectService.deleteProject(id).then(
      (deletedProject) => {
        dispatch({
          type: DELETE_PROJECT,
          id: deletedProject.id
        });
      },
      errMessage => dispatch(error(DELETE_PROJECT, { errMessage }))
    );
  };
}

function request(actionType) {
  return {
    type: `${actionType}_REQUEST`
  };
}

function error(actionType, actionPayload) {
  return {
    type: `${actionType}_ERROR`,
    ...actionPayload
  };
}

export default projectActions;
