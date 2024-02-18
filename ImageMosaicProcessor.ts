import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// i could make this class based and even split functions up to appropriate files and areas in the repo.
// I guess to make things easy for you to read ill do a simpler approach and easier for me

interface RgbImageData {
  key: string
  averageRGB: {
    r: number
    g: number
    b: number
  }
}

interface RgbAssetData {
  key: string
  subfolder: string
  averageRGB: {
    r: number
    g: number
    b: number
  }
}

interface DeltaEasssetObject {
  key: number
  assetKey: string
  assetSubfolder: string
}

const fetchAssetsRGB = async(): Promise<{ fileName: string, subfolder: string, averageRGB: { r: number, g: number, b: number } }[]> => {
  const assetsPath = path.join(__dirname, '101_ObjectCategories')
  
  try {
    const files = await fs.promises.readdir(assetsPath)
    
    const subfolders = await Promise.all(files.map(async subfolder => {


      const imagesInSubfolder = await fs.promises.readdir(assetsPath +`/${subfolder}`)
      const images = await Promise.all(imagesInSubfolder.map(async image => {

        const filePath = path.join(assetsPath, subfolder, image)
        const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true })
        const length = info.width * info.height
        let [rSum, gSum, bSum] = [0, 0, 0]
  
        for (let i = 0; i < data.length; i += 3) {
          rSum += data[i]
          gSum += data[i + 1]
          bSum += data[i + 2]
        }
  
        return {
          fileName: image,
          subfolder: subfolder,
          averageRGB: {
            r: Math.round(rSum / length),
            g: Math.round(gSum / length),
            b: Math.round(bSum / length),
          },
        }
      }))
      return images
      
    }))
    throw new Error('Failed to process images.')


  } catch (error) {
    console.error('Error processing images:', error)
    throw new Error('Failed to process images.')
  }
}




const saveAssetsDataInObject = async(): Promise<RgbAssetData[]> => {
  const assetsRGBData = [] as RgbAssetData[]

  await fetchAssetsRGB()
  .then(results => {
    console.log('Average RGB values for each image:')
    results.forEach(result => {


      console.log(`${result.fileName}: RGB(${result.averageRGB.r}, ${result.averageRGB.g}, ${result.averageRGB.b})`)

      // save ALL assets data in one object to be fetched
      assetsRGBData.push({
        key: result.fileName,
        subfolder: result.subfolder,
        averageRGB: {
          r: result.averageRGB.r, 
          g: result.averageRGB.g, 
          b: result.averageRGB.b,
        },
      })
    })
  })
  .catch(error => {
    console.error('An error occurred:', error)
  })

  return assetsRGBData
}


const splitImageAndCalculateRGB = async(base64Image: string): Promise<RgbImageData[]> => {

  // from our resolver from the front end sent mutation we are to send this base64 image to this function (directly from resolver, bull queue or even save to db and ping back)
  const imageBuffer = Buffer.from(base64Image, 'base64')
  
  // using sharp, pur image processing package we will 'decode' this image to a buffer once again to perform our dissection
  const image = sharp(imageBuffer)
  const { width, height } = await image.metadata()
  
  if (!width || !height) {
    throw new Error('Could not get image dimensions')
  }
  
  const pieceWidth = width / 20
  const pieceHeight = height / 20
  const results: RgbImageData[] = []

  let peiceNumber = 0
  for (let y = 0; y < 20; y++) {

    for (let x = 0; x < 20; x++) {

      // cut my image, grab the peice.
      // note i did attempt to merge the splitting to rgb function into its own one to be called upon so that i dont repeat myself 
      // BUT i needed to run the image through SHARP to dissect it out and if that is to be done in a function id need to run the image each time in the child function which is 400 times , 399 times not needed
      
      
      const piece = await image
        .extract({ left: Math.floor(x * pieceWidth), top: Math.floor(y * pieceHeight), width: Math.floor(pieceWidth), height: Math.floor(pieceHeight) })
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      let rSum = 0, gSum = 0, bSum = 0
      for (let j = 0; j < piece.data.length; j+=3) {
        rSum += piece.data[j]
        gSum += piece.data[j + 1]
        bSum += piece.data[j + 2]
      }
      
      const numPixels = pieceWidth * pieceHeight
      results.push({
        key: `${peiceNumber}`, // this is to track the peice of our dissected image such that we can hold onto the bad boy for replacement and reassembly.
        averageRGB: {
          r: Math.round(rSum / numPixels),
          g: Math.round(gSum / numPixels),
          b: Math.round(bSum / numPixels),
        },
      })

      peiceNumber ++
    }
  }
  
  return results
}



const rgbToXyz = async(r:number, g:number, b:number) => {
  let R = r / 255
  let G = g / 255
  let B = b / 255

  R = R > 0.04045 ? Math.pow(((R + 0.055) / 1.055), 2.4) : R / 12.92
  G = G > 0.04045 ? Math.pow(((G + 0.055) / 1.055), 2.4) : G / 12.92
  B = B > 0.04045 ? Math.pow(((B + 0.055) / 1.055), 2.4) : B / 12.92

  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750) / 1.00000
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883

  return [X, Y, Z]
}

const xyzToLab = async(x: number, y: number, z: number) => {
  let X = x
  let Y = y
  let Z = z

  X /= 95.047
  Y /= 100.000
  Z /= 108.883

  X = X > 0.008856 ? Math.pow(X, 1/3) : (7.787 * X) + (16 / 116)
  Y = Y > 0.008856 ? Math.pow(Y, 1/3) : (7.787 * Y) + (16 / 116)
  Z = Z > 0.008856 ? Math.pow(Z, 1/3) : (7.787 * Z) + (16 / 116)

  const L = (116 * Y) - 16
  const a = 500 * (X - Y)
  const b = 200 * (Y - Z)

  return [L, a, b]
}


const deltaE = async(labA: number[], labB: number[]) => {
  return Math.sqrt(
    Math.pow((labA[0] - labB[0]), 2) +
    Math.pow((labA[1] - labB[1]), 2) +
    Math.pow((labA[2] - labB[2]), 2)
  )
}






const compareColors = async(rgbA: number[], rgbB: number[]) =>{

  const rgbARed = rgbA[0]
  const rgbAGreen = rgbA[1]
  const rgbABlue = rgbA[2]


  const rgbBRed = rgbB[0]
  const rgbBGreen = rgbB[1]
  const rgbBBlue = rgbB[2]


  const xyzA = await rgbToXyz(rgbARed, rgbAGreen, rgbABlue)
  const xyzB = await rgbToXyz(rgbBRed, rgbBGreen, rgbBBlue)
  
  const xyzAx = xyzA[0]
  const xyzAy= xyzA[1]
  const xyzAz= xyzA[2]


  const xyzBx = xyzB[0]
  const xyzBy= xyzB[1]
  const xyzBz = xyzB[2]

  const labA = await xyzToLab(xyzAx, xyzAy, xyzAz)
  const labB = await xyzToLab(xyzBx, xyzBy, xyzBz)
  
  
  return deltaE(labA, labB)
}

const  fetchImage = async (pathToAssetImage: string) => {
  return path.join(__dirname, 'assets', `${pathToAssetImage}.jpg`);
}


const resizeImage = async (pathToAssetImage: string) => {
  const imagePath = await fetchImage(pathToAssetImage)



  return sharp(imagePath)
    .resize(54, 54) // 400th of the 1080p image i forced us to upload from FE
    .toBuffer()
}

const convertImageToBase64 = async(imagePath: fs.PathOrFileDescriptor) =>{
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  return `data:image/png;base64,${imageBase64}`;
}


// this being the function our resolver will call upon and have a value returned to, for the front end to recieve
export const processMosaic = async(base64Image: string): Promise<string> =>{
  
  const assetRGBObject = await saveAssetsDataInObject()
  const uploadedRGBObject = await splitImageAndCalculateRGB(base64Image) as RgbImageData[]

  // now that i have my assets saved in an object with key = asset name, rgb values saved within that
  // and i have the dissected 400 peice image thats been uploaded in the same format

  // we can look for the closest matching asset using  "Delta E* CIE" and then use these transformations to go from RGB-> CIE-L*ab method


  // we will need to loop and take each piece of our 400 cut image
  // and compare to ALL assets then save the key of the closest one in a new object that will be 400 items long 
  // keeping note of the placement by using the same rows cols keying method that i used to splt the image with.

  
  const arrayOfMatchingStrings:DeltaEasssetObject[] = []

  for (let index = 0; index < uploadedRGBObject.length; index++) {

    const uploadedKey = Number(uploadedRGBObject)
    const imageSegment = uploadedRGBObject.find((segment)=> Number(segment.key) === index)
    let matchingImageKey: string = ''
    let assetSubfolder:string =  ''
    if (imageSegment) {

      const segmentR = imageSegment.averageRGB.r
      const segmentG = imageSegment.averageRGB.g
      const segmentB = imageSegment.averageRGB.b

      let lowestDifference = Infinity
      for (let asset = 0; asset< assetRGBObject.length; asset++) {

        const assetImage = assetRGBObject[asset]
        const assetImageR = assetImage.averageRGB.r
        const assetImageG = assetImage.averageRGB.g
        const assetImageB = assetImage.averageRGB.b
    
        const colorDifference = await compareColors ([segmentR,segmentG,segmentB],[assetImageR,assetImageG,assetImageB])

        if (colorDifference<lowestDifference) { 
          lowestDifference = colorDifference
          matchingImageKey = assetImage.key
          assetSubfolder = assetImage.subfolder
        }

    
      }

      arrayOfMatchingStrings.push({key: index, assetKey: matchingImageKey, assetSubfolder: assetSubfolder}) // this will then save each matching image as key in order from 0 - 400 as key is number and assetKey is the key of the image pulled from the assetsfolder

    }


  }

  const finalObjectToReassemble = arrayOfMatchingStrings
  
  // for each in order take key, fetch image with same name from assets folder, then take that image and downsize it to 54*54 px size and then assemble in order
  // 20 each row in order till its 20*20 image


  
    const imagesPerRow = 20
    const imageSize = 54
    const totalSize = imagesPerRow * imageSize
    const canvas = sharp({
      create: {
        width: totalSize,
        height: totalSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
  
    // Sort arrayOfMatchingStrings by key
    arrayOfMatchingStrings.sort((a, b) => a.key - b.key)
  
    for (const item of arrayOfMatchingStrings) {

      const pathToAssetImage = `${item.assetSubfolder}`+`/`+`${item.assetKey}`


      const imageBuffer = await resizeImage(pathToAssetImage)
      const rowIndex = Math.floor(item.key / imagesPerRow)
      const columnIndex = item.key % imagesPerRow
      const x = columnIndex * imageSize
      const y = rowIndex * imageSize
  
      canvas.composite([{ input: imageBuffer, left: x, top: y }])
    }
  
    // Save the final assembled image
    await canvas.toFile(path.join(__dirname, 'finalAssembledImage.png'))
    .then(() => console.log('Image assembly complete.'))
    .catch((error) => console.error('Error assembling images:', error))


    

  // return that image to FE , i personally would have it cloud stored in one of our systems but for the sake of having things nice and wrapped up imma return a base64 image to the front end as a result of the entire function so it shows to user on the interface



  const imagePath = path.join(__dirname, 'finalAssembledImage.png')
  convertImageToBase64(imagePath)
  .then((base64Image) => {
    return(base64Image)
  })
  .catch((error) => console.error('Error converting image to Base64:', error))


  return base64Image
}

