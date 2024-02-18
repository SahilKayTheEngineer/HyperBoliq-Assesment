# Image Mosaic Generator

This project consists of a React-based frontend component and a Node.js backend script designed to create image mosaics. The frontend allows users to upload an image, which is then processed on the backend to create a mosaic image composed of smaller images based on color similarity.
And then return the new processed image back to the front end component for the user to view.

## Features

- **Image Upload and Cropping**: Users can upload an image through the frontend interface. The image can be cropped to a square format before submission.
- **Image Mosaic Processing**: The backend receives the image, splits it into smaller segments, and replaces each segment with an image from a predefined asset library that closely matches the segment's average color.
- **GraphQL Integration**: The frontend uses Apollo Client to handle GraphQL mutations for uploading the image.
- **Styled Components**: The frontend utilizes styled-components for styling the application.

## Frontend

### Technologies

- React
- Apollo Client
- React Image Crop - npm i react-image-crop
- Styled Components

### Setup

1. Ensure you have `node` and `npm` installed.
2. Clone the repository and navigate to the frontend directory.
3. Run `npm install` to install dependencies. - npm i react-image-crop
4. Start the development server using `npm start`.

### Usage

- The main component is `<ImageMosaicPage />`, which renders the image upload and cropping interface.
- Upon image selection, the user can crop the image to a square format.
- After cropping, the image is automatically submitted to the backend for mosaic processing.
- Upon processing the new mosaic image built from assets matching the 400 piece image will be retuned
- Assets folder named 101_ObjectCategories (Caltech file provided) is implied to exist on the same level in repo

## Backend

### Technologies

- Node.js
- Sharp for image processing - npm i sharp
- fs and path for file system operations

### Setup

1. Ensure you have `node` and `npm` installed.
2. Navigate to the backend directory.
3. Run `npm install` to install dependencies. npm i sharp

### Image Processing Overview

- The script processes uploaded images by splitting them into smaller segments.
- Each segment's average RGB color is calculated and matched with the closest color from a predefined asset library using the Delta E color difference formula.
- The matched images are then resized, assembled into a mosaic, and returned to the frontend.

### Running the Script

The script can be integrated with a backend server or run as part of a job queue for processing uploaded images.

## Contributing

Contributions are welcome. Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
