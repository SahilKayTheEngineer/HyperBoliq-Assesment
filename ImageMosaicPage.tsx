import { useMutation } from '@apollo/client/react/hooks/useMutation'
import React, { useState } from 'react'
import ReactCrop, { Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import styled from 'styled-components'

const ImageMosaicPageContainer = styled.div`
  // I would add stylings here according to design and spec for the page in general and for each component. 
  // For task purposes i will be just using the raw inputs for JSX componenets and divs from now on.- Sahil
`

const InputImageContainer = styled.div`
`
const OutputImageContainer = styled.div` 
`

export function ImageMosaicPage(): JSX.Element {

  // setting image as ref, react hook useRef could be used here too if im not mistaking.
  const [src, setSrc] = useState<string | ArrayBuffer | null>(null)
  // useMutation hook
  const [uploadImage] = useMutation(UPLOAD_IMAGE_MUTATION)

  // looking below, this hook will force a crop box over the image at the size of 1080*1080,
  // react image crop is a node package available, documentation link will be found in the readme file
  // this will be handy to manage max size of images in the case we are saving to our servers
  // as well as force a square image so the dividing can take place cleanly

  const [crop, setCrop] = useState<Crop>({
    unit: 'px',
    width: 1080,
    height: 1080,
    aspect: 1 / 1,
  })

  // our returned image
  const [processedImage, setProcessedImage] = useState<string | null>(null)

  const maxImageSizeMB = 10

  // update image ref, to allow user to change out images before submitting. Also added a max size of 10Mb to save server space with a lil warning msg
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {

      const selectedImage = e.target.files[0]

      if (selectedImage.size > maxImageSizeMB * 1024 * 1024) {
        alert(`The image size should not exceed ${maxImageSizeMB} MB.`)
        return
      }

      const reader = new FileReader()
      reader.addEventListener('load', () => setSrc(reader.result))
      reader.readAsDataURL(selectedImage)
    }
  }

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const getCroppedImgBlob = (imageSrc: string, crop: Crop): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.src = imageSrc
      image.setAttribute('crossOrigin', 'anonymous')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      image.onload = () => {
        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height
        canvas.width = crop.width ?? 0
        canvas.height = crop.height ?? 0

        ctx.drawImage(
          image,
          (crop.x ?? 0) * scaleX,
          (crop.y ?? 0) * scaleY,
          (crop.width ?? 0) * scaleX,
          (crop.height ?? 0) * scaleY,
          0,
          0,
          crop.width ?? 0,
          crop.height ?? 0,
        )

        // Convert the canvas to a blob
        canvas.toBlob((blob) => {
          if (!blob) {
            // Handle the error
            reject(new Error('Canvas is empty'))
            return
          }
          resolve(blob)
        }, 'image/jpeg')
      }

      image.onerror = () => {
        reject(new Error('Image loading error'))
      }
    })
  }

  const _handleSubmitImage = async (crop: Crop) => {

    // now that react crop has added the overlay of the crop box to the uploaded image for the user to select a cropped version to our spec,
    // we gotta convert image to blob and i use a mutation to send the image through to the back end for processing using apollo GQL.
    // Im sure youre tired of me talking about apollo at this point, ive mentioned it in the interview too, just a big fan of the framework. lol

    try {
      getCroppedImgBlob(String(src), crop).then(async (blob) => {
        // Convert the blob to a base64 string
        const base64Image = await blobToBase64(blob)

        // Use the mutation to upload the image
        uploadImage({
          variables: {
            image: base64Image,
          },
        }).then((response: { data: UploadImageReturnImageType }) => {
          // Assuming the processed image is returned in response.data.uploadImage.processedImage
          const processedImageBase64 = response.data.uploadImage.processedImage
          setProcessedImage(processedImageBase64) // Save the processed image in state
          alert('Image uploaded successfully.')
        })
      })
    } catch (err) {
      console.log(err)
      alert('Image failed to upload')

    }

  }

  return (

    <ImageMosaicPageContainer>
      <InputImageContainer>
        <input type="file" accept="image/*" onChange={onFileChange} />
        {src && (
          <ReactCrop
            src={String(src)}
            crop={crop}
            onChange={(newCrop: any) => setCrop(newCrop)}
            onComplete={_handleSubmitImage}
          />
        )}
      </InputImageContainer>

      <OutputImageContainer>
        {processedImage && <img src={processedImage} alt="Processed Image" />}
      </OutputImageContainer>

    </ImageMosaicPageContainer>

  )
}
