# Non-Linear Editing of Text-Based Screencasts

> Non-Linear Editing of Text-Based Screencasts (UIST '18)  
> https://dl.acm.org/citation.cfm?id=3242654

A prototype impelementation of non-linear editor for text-based screencasts. The tool allows users to edit any arbitrary part of a text-based screencast while preserving the overall consistency of the screencast.

<p align="center"><img alt="intro.gif" src="https://raw.githubusercontent.com/elicast-research/non-linear-edit/master/imgs/intro.gif" width="60%"></p>

If you use this code for academic purposes, please cite it as:

```
@inproceedings{park2018nonlinear,
  title={Non-Linear Editing of Text-Based Screencasts},
  author={Park, Jungkook and Park, Yeong Hoon and Oh, Alice},
  booktitle={The 31st Annual ACM Symposium on User Interface Software and Technology},
  pages={403--410},
  year={2018},
  organization={ACM}
}
```

## Non-Linear Editing

### Ambiguous Positioning Problem

<p align="center"><img alt="problem.gif" src="https://raw.githubusercontent.com/elicast-research/non-linear-edit/master/imgs/problem.gif" width="60%"></p>

Unlike non-linear editing of video, editing a part of the screencast without properly handling all of its subsequent OTs will result in unexpected screencast content. This is because each text editing operation of a text-based screencast is dependent on all of its prior operations.

With the devised algorithm in our research, our tool resolve the amgituity by showing users all possible resolutions and explicitly let them decide a resolution of intended.

### Non-Linear Editing Interface

#### 1. Time Range Selection

<p align="center"><img alt="timerange.gif" src="https://raw.githubusercontent.com/elicast-research/non-linear-edit/master/imgs/timerange.gif" width="60%"></p>

The user first select a time range from the screencast where they wish to crop out and replace with a new recording.

#### 2. Record New Recording

In this step, the user records a new recording for the sliced time range that they selected in the previous step.

#### 3. Ambiguity Resolution

<p align="center"><img alt="resolver.gif" src="https://raw.githubusercontent.com/elicast-research/non-linear-edit/master/imgs/resolver.gif" width="60%"></p>

If there is any ambiguity occurred from the edit, the user goes through an ambiguity resolution process where they manually choose the resolution as they intended with the 'Ambiguity Resolver' interface.

## How to Use

### Build Setup

``` bash
# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# run unit tests
npm run unit
```

### Connect to the backend

Currently, this project requires a backend server to run. We will soon make the code for backend server available, and support 'local' run mode so the editor can be run as standalone without the need of a backend server.
