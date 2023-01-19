const { storage } = require('../config/firebase.js');
const { ref, uploadBytesResumable, getDownloadURL, deleteObject, updateMetadata, getMetadata } = require('firebase/storage');
const { getGlobal } = require('@firebase/util');
const Module = require('../models/Module')
const User = require('../models/User');
const ResourceLink = require('../models/ResourceLinks');
const modulesController = {};
var idModulo, idModuloTest;



// CREAR MÓDULO
modulesController.renderModuleForm = (req, res) => {
    res.render('modulesCourse/newModule', { name: req.user.name })
}

modulesController.createNewModule = async (req, res) => {

    let urlImg;
    const nameVideos = [];
    const referenceURL = [];
    const datosVideos = {};
    var arrDataVideos = [];
    const { _id, nameModule, nameAuthor, descriptionModule, categoryModule } = req.body;
    const videos = Object.assign({}, req.files);
    let nameModuleReady = await Module.findOne({ nameModule: nameModule });

    if (nameModuleReady) {
        req.flash('error_msg', 'El nombre del módulo ya se encuentra en uso, por favor use otro nombre.');
        res.redirect('/modulesCourse/add');
    }


    let storageRefImg = ref(storage, `${nameModule}/${req.files.img.name}`);
    let uploadImg = uploadBytesResumable(storageRefImg, req.files.img.data);

    // SUBIENDO LA IMAGEN
    uploadImg.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
                case 'paused':
                    console.log('Upload is paused');
                    break;
                case 'running':
                    console.log('Upload is running');
                    break;
            }
        },
        (error) => {
            console.log(error);
            req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
            res.redirect('/viewsAdmi/admi');
        },
        () => {
            getDownloadURL(uploadImg.snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
                urlImg = downloadURL;
            });
        }
    );


    videos.file.forEach(function (element) {
        console.log(decodeURIComponent(escape(element.name)));
        nameVideos.push(decodeURIComponent(escape(element.name)));
    });


    // SUBIENDO VIDEOS
    videos.file.forEach(function (element) {
        let storageRef = ref(storage, `${nameModule}/${decodeURIComponent(escape(element.name))}`);
        let uploadTask = uploadBytesResumable(storageRef, element.data);

        uploadTask.on('state_changed', (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload is ${progress} % done ${decodeURIComponent(escape(element.name))}`);
            switch (snapshot.state) {
                case 'paused':
                    console.log('Upload is paused');
                    break;
                case 'running':
                    console.log('Upload is running');
                    break;
            }
        },
            (error) => {
                req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                    console.log('File available at', downloadURL);
                    referenceURL.push(downloadURL);
                    datosVideos[`${decodeURIComponent(escape(element.name))}`] = downloadURL

                    if (referenceURL.length == videos.file.length) {
                        // INSERTANDO DATOS
                        arrDataVideos = Object.entries(datosVideos);
                        arrDataVideos.sort();

                        const newModule = new Module({
                            id: _id,
                            nameModule: nameModule,
                            nameAuthor: nameAuthor,
                            descriptionModule: descriptionModule,
                            referenceURLs: referenceURL,
                            nameVideos: nameVideos,
                            dataVideos: arrDataVideos,
                            img: urlImg,
                            category: categoryModule
                        });
                        let nuevoModulo = await newModule.save();
                        idModuloTest = nuevoModulo._id;

                        if (req.body.cuestionario) {
                            req.flash('success_msg', 'Módulo cargado, ahora puede añadir un cuestionario.');
                            res.redirect(`/modulesCourse/renderTestForm/${idModuloTest}`);
                        } else {
                            req.flash('success_msg', 'Módulo creado correctamente.');
                            res.redirect('/viewsAdmi/admi');
                        }

                    }
                });
            });
    });

}


// AÑADIR TEST
modulesController.renderTestForm = async (req, res) => {
    const module = await Module.findById(req.params.id);
    console.log(module);
    res.render('modulesCourse/addTest', { module });
}

modulesController.addTest = async (req, res) => {
    
    const module = await Module.findById(req.params.id);
    const ObjetoAsk = Object.assign({}, req.body);
    const imagenes = Object.assign({}, req.files);
    console.log(ObjetoAsk);
    const preguntas = Object.values(ObjetoAsk);

    let urlImgs = [];
    let numPregunta = 0;
    /** Si la pregunta es de tipo drag and drop, se suben imagenes a firebase
    preguntas.forEach(function (element) {
        console.log('entro al for de preguntas');
        if (element[0] == "draganddrop") {
            let index = 0;
            element.forEach(async function (value) {
                if (`${index}` > 1){
                    let storageRefImg = ref(storage, `${module.nameModule}/pregunta${numPregunta}/pareja${index}/${imagenes[`img${numPregunta+1}${index-2}`].name}`);
                    let uploadImg = uploadBytesResumable(storageRefImg, imagenes[`img${numPregunta+1}${index-2}`].data);

                    await uploadImg;

                    const downloadUrl = getDownloadURL(uploadImg.snapshot.ref);
                    urlImgs.push(downloadUrl);
                    console.log(urlImgs);
                    /**getDownloadURL(uploadImg.snapshot.ref).then((downloadURL) => {
                        console.log("File available at", downloadURL);
                        
                        urlImgs.push(downloadURL);
                        element.push(downloadURL);
                        console.log('estas');
                        if (urlImgs.length == (element.length - 2)/2) {
                            console.log(preguntas);
                            console.log(numPregunta);
                        }
                    });
                }
                index++;
            });
        }
        numPregunta++;
        console.log(numPregunta);
    });
    console.log(urlImgs);*/
    console.log(preguntas);
    await Module.findByIdAndUpdate(module.id, { test: preguntas });
    req.flash('success_msg', 'Cuestionario cargado exitosamente.');
    console.log('me fui');
    res.redirect('/viewsAdmi/admi');
}



// MOSTRAR LISTA DE VÍDEOS
modulesController.showModule = async (req, res) => {
    const module = await Module.findById(req.params.id);
    // Datos PDF
    let resourcesModules = await ResourceLink.find();
    let datosPDF = Object.assign({}, resourcesModules);

    idModulo = req.params.id;
    let nameVideos = module.nameVideos;
    let urls = module.referenceURLs;
    let data = Object.fromEntries(module.dataVideos);
    let test = module.test;

    let url = data[`${nameVideos[0]}`];
    
    let nameThisVideo = nameVideos[0].split('.')[0];
    
    if(resourcesModules.length != 0) {
        res.render('modulesCourse/showModule', { nameModule: module.nameModule, nameThis: nameThisVideo, name: req.params.name, links: url, nameVideos, id: req.params.id, test, resourcesModule: true, urlSource: datosPDF['0'].resourceURL });
    } else {
        res.render('modulesCourse/showModule', { nameModule: module.nameModule, nameThis: nameThisVideo, name: req.params.name, links: url, nameVideos, id: req.params.id, test, resourcesModule: false });
    }
    
}

modulesController.renderVideo = async (req, res) => {
    const module = await Module.findById(idModulo);
     // Datos PDF
     let resourcesModules = await ResourceLink.find();
     let datosPDF = Object.assign({}, resourcesModules);

    let nameVideos = module.nameVideos;
    let data = Object.fromEntries(module.dataVideos);
    let url = data[`${req.params.name}`];
    let test = module.test;

    let nameThisVideo = req.params.name.split('.')[0];

    if(resourcesModules.length != 0) {
        res.render('modulesCourse/renderVideo', { nameModule: module.nameModule, nameThis: nameThisVideo, nameVideos, id: idModulo, url, test, resourcesModule: true, urlSource: datosPDF['0'].resourceURL });
    } else {
        res.render('modulesCourse/renderVideo', { nameModule: module.nameModule, nameThis: nameThisVideo, nameVideos, id: idModulo, url, test, resourcesModule: false});
    }

   
}



// CUESTIONARIO
modulesController.renderTest = async (req, res) => {
    const module = await Module.findById(idModulo);
    let preguntas = module.test
    res.render('modulesCourse/test', { nombreModulo: module.nameModule, preguntas });
}


// RESULTADOS
modulesController.resultsTest = async (req, res) => {
    const module = await Module.findById(idModulo);
    let nameModule = module.nameModule;
    let preguntas = module.test;
    let respuestasUsuario = req.body.respuestas;
    let respuestasCorrectas = [];
    let totalPreguntas = respuestasUsuario.length;
    let promedio = 0;
    var respuestasAsertadas = 0;

    console.log(preguntas);
    console.log(respuestasUsuario);

    for (let i = 0; i < preguntas.length; i++) {
        if (preguntas[i][0] == "abierta") { // Preguntas abiertas
            respuestasCorrectas.push(preguntas[i][2]);
        }else if (preguntas[i][0] == "multiple") { // Preguntas de opción múltiple
            respuestasCorrectas.push(preguntas[i][6]);
        }else if (preguntas[i][0] == "relaciona") { // Preguntas de relacionar columnas
            for (let index = 0; index < preguntas[i].length; index++) {
                if (index > 1 && (index % 2 != 0)){
                    respuestasCorrectas.push(preguntas[i][index]);
                }
            }
        }else if (preguntas[i][0] == "lista") { // Preguntas con respuestas en lista
            respuestasCorrectas.push(preguntas[i][preguntas[i].length - 1]);
        }else if (preguntas[i][0] == "draganddrop"){ // Preguntas con respuestas drag and drop
            let respAux= "";
            for (let index = 0; index < preguntas[i].length; index++) {
                if (index > 1 && index % 2 != 0){
                    respAux = respAux + preguntas[i][index] + ",";
                }
            }
            respAux = respAux.replace(/,\s*$/, "");
            respuestasCorrectas.push(respAux);
        }else{ // Preguntas con el formato viejo
            respuestasCorrectas.push(preguntas[i][5]);
        }
        
    }
    console.log("respuestas correctas ",respuestasCorrectas);
    for (let i = 0; i < respuestasCorrectas.length; i++) {
        if (respuestasCorrectas[i] == respuestasUsuario[i]) {
            respuestasAsertadas++;
        }
    }

    promedio = (respuestasAsertadas * 100) / totalPreguntas;
    
    if (promedio >= 80) {
        const user = await User.findById(req.user._id);
        let progress = user.avances;
        let newProgress = { nameModule: nameModule, resultado: promedio.toFixed(2) };
        progress.push(newProgress);
        await User.findByIdAndUpdate(user._id, { avances: progress });

    }

    res.render('modulesCourse/resultsTest', { totalPreguntas, respuestasAsertadas, promedio , user: req.user, nameModule });
}


// ACTUALIZAR MÓDULO
modulesController.renderUpdateModule = async (req, res) => {
    const module = await Module.findById(req.params.id);
    res.render('modulesCourse/updateModule', { module });
}

modulesController.updateModule = async (req, res) => {
    const module = await Module.findById(req.params.id);
    var nameModule;
    let nameAuthor = module.nameAuthor;
    let descriptionModule = module.descriptionModule;
    const videos = Object.assign({}, req.files);
    const nameVideos = [];
    const referenceURL = [];
    const datosVideos = {};
    var arrDataVideos = [];
    let urlImg;

    // COMPARANDO SI LOS CAMPOS CAMBIARON
    if (module.nameModule === req.body.nameModule) {
        nameModule = module.nameModule;
    } else {
        nameModule = req.body.nameModule;
    }

    if ((req.body.file == '' && req.body.img == '') || req.files == null) {
        await Module.findByIdAndUpdate(req.params.id, {
            nameModule: nameModule,
            nameAuthor: req.body.nameAuthor,
            descriptionModule: req.body.descriptionModule
        });

        req.flash('success_msg', 'Módulo actualizado exitosamente');
        res.redirect('/viewsAdmi/admi');

    } else {
        let storageRefImg = ref(storage, `${nameModule}/${req.files.img.name}`);
        let uploadImg = uploadBytesResumable(storageRefImg, req.files.img.data);

        // ACTUALIZAR IMAGEN
        uploadImg.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
                switch (snapshot.state) {
                    case 'paused':
                        console.log('IMG Upload is paused');
                        break;
                    case 'running':
                        console.log('IMG Upload is running');
                        break;
                }
            },
            (error) => {
                req.flash('success_msg', 'Actualizado');
                res.redirect('/viewsAdmi/admi');
            },
            () => {

                getDownloadURL(uploadImg.snapshot.ref).then(async (downloadURL) => {
                    console.log('File available at', downloadURL);
                    urlImg = downloadURL;
                });
            }
        );
        // FIN IMG


        // ACTUALIZAR VIDEOS
        videos.file.forEach(function (element) {
            let storageRef = ref(storage, `${nameModule}/${element.name}`);
            let uploadTask = uploadBytesResumable(storageRef, element.data);

            uploadTask.on('state_changed', (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload is ${progress} % done`);
                switch (snapshot.state) {
                    case 'paused':
                        console.log('Upload is paused');
                        break;
                    case 'running':
                        console.log('Upload is running');
                        break;
                }
            },
                (error) => {
                    req.flash('success_msg', 'Actualizado');
                    res.redirect('/viewsAdmi/admi');
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                        console.log('File available at', downloadURL);
                        // INSERTANDO DATOS URL
                        referenceURL.push(downloadURL);
                        nameVideos.push(`${element.name}`);
                        datosVideos[`${element.name}`] = downloadURL;


                        if (referenceURL.length == videos.file.length) {
                            arrDataVideos = Object.entries(datosVideos);
                            arrDataVideos.sort();
                            nameVideos.sort();
                            const newModule = await Module.findByIdAndUpdate(req.params.id,
                                {
                                    nameModule: nameModule,
                                    nameAuthor: req.body.nameAuthor,
                                    descriptionModule: req.body.descriptionModule,
                                    referenceURLs: referenceURL,
                                    nameVideos: nameVideos,
                                    dataVideos: arrDataVideos,
                                    img: urlImg
                                });
                            req.flash('success_msg', 'Actualizado');
                            res.redirect('/viewsAdmi/admi');
                        }
                    });
                });
        });
        // FIN VIDEOS
    }
}



// DELETE MÓDULE 
modulesController.deleteModule = async (req, res) => {
    const module = await Module.findByIdAndDelete(req.params.id);
    req.flash('success_msg', `Módulo "${module.nameModule}" eliminado exitosamente.`);
    res.redirect('/viewsAdmi/admi');
}


// MOSTRAR RECURSOS (LINKS)
modulesController.resourcesModules = async (req, res) => {

    let resourcesModules = await ResourceLink.find();
    let datosPDF = Object.assign({}, resourcesModules);

    if(resourcesModules.length != 0) {
        res.render('modulesCourse/resourcesModules', { name: datosPDF['0'].nameResource, url: datosPDF['0'].resourceURL });
    } else {
        res.render('modulesCourse/resourcesModules', {noResources: true});
    }

    
}


modulesController.createResourcesModule = async (req, res) => {
    const nameFolder = "Recursos módulo";
    let storageRefPDF = ref(storage, `${nameFolder}/${req.files.pdf.name}`);
    let createPDF = uploadBytesResumable(storageRefPDF, req.files.pdf.data);

    const newMetadata = {
        contentType: 'application/pdf',
        customMetadata: 'application/pdf'
    }

    createPDF.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
                case 'paused':
                    console.log('Upload is paused');
                    break;
                case 'running':
                    console.log('Upload is running');
                    break;
            }
        },
        (error) => {
            req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
            res.redirect('/viewsAdmi/admi');
        },
        () => {
            getDownloadURL(createPDF.snapshot.ref).then(async (downloadURL) => {

                await updateMetadata(storageRefPDF, newMetadata)
                    .then((metadata) => {

                    }).catch((error) => {
                        req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
                        res.redirect('/viewsAdmi/admi');
                    });


                    const newResource = new ResourceLink ({
                        nameResource: req.files.pdf.name,
                        resourceURL: downloadURL
                    });

                    await newResource.save();

                req.flash('success_msg', `Archivo ${req.files.pdf.name} subido correctamente.`);
                res.redirect('/modulesCourse/resourcesModules');

            });
        }
    );
}


modulesController.updateResourcesModules = async (req, res) => {

    const nameFolder = "Recursos módulo";
    let storageRefPDF = ref(storage, `${nameFolder}/${req.files.pdf.name}`);
    let uploadPDF = uploadBytesResumable(storageRefPDF, req.files.pdf.data);

    const newMetadata = {
        contentType: 'application/pdf',
        customMetadata: 'application/pdf'
    }

    let deletePDF = ref(storage, `${nameFolder}/${req.params.name}`);

    deleteObject(deletePDF).then(() => {
        console.log(`${req.params.name} Eliminado de firebase`)
      }).catch((error) => {
        console.log("Hubo un error");
      });

    // SUBIENDO LA PDF
    uploadPDF.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
            switch (snapshot.state) {
                case 'paused':
                    console.log('Upload is paused');
                    break;
                case 'running':
                    console.log('Upload is running');
                    break;
            }
        },
        (error) => {
            req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
            res.redirect('/viewsAdmi/admi');
        },
        () => {
            getDownloadURL(uploadPDF.snapshot.ref).then(async (downloadURL) => {

                await updateMetadata(storageRefPDF, newMetadata)
                    .then((metadata) => {

                    }).catch((error) => {
                        req.flash('error_msg', 'Hubo un error, vuelva a intentelor.');
                        res.redirect('/viewsAdmi/admi');
                    });


                await ResourceLink.findOneAndUpdate({ nameResource: req.params.name },
                    {
                        nameResource: req.files.pdf.name,
                        resourceURL: downloadURL
                    })

                req.flash('success_msg', `Archivo ${req.files.pdf.name} actualizado correctamente.`);
                res.redirect('/modulesCourse/resourcesModules');

            });
        }
    );

}


// FILTRAR
modulesController.filterModules = async (req, res) => {
    var hardware = false;
    var software = false;
    var dudas = false;
    var manualUsuario = "https://firebasestorage.googleapis.com/v0/b/tt-ii-b3735.appspot.com/o/Manual%20de%20usuario.pdf?alt=media&token=55bbf3cb-91af-40b9-a83a-27db6b09360d";
    let category = req.params.category;
    
    if(category == "Hardware") {
        hardware = true
    } else if(category == "Software") {
        software = true
    } else {
        dudas = true
    }
    
    const modules = await Module.find({category: req.params.category}).sort({ nameModule: 'asc' });
    res.render('viewsUser/user', { modules, hardware, software, dudas, manualUsuario});
    
}



module.exports = modulesController;

