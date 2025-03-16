//imports
const express = require('express'); //framework use for server 
const path = require('path');
const morgan = require('morgan');
const mongoose = require('mongoose');
const mysql = require('mysql');
const session = require('express-session');
const bcrypt = require('bcrypt');
const passport = require('passport');
const bodyparser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const fs = require('fs');
const router = require('./router');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
require('dotenv').config();

const Razorpay = require('razorpay');



const storeItems = new Map([
    [1, { priceInCents: 10000, name: 'Learn React' }],
    [2, { priceInCents: 20000, name: 'Learn CSS' }]]
);



//connection to mysql
const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'beat_store'

});

con.connect(function (err) {
    if (err) throw err;
    console.log('Connected');
})


//"test": "echo \"Error: no test specified\" && exit 1" to be stored in package.json scripts section
const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './imgs_audio';
        // Create the uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        return cb(null, `${Date.now()}-${file.originalname}`)

    }
})
const upload = multer({ storage: storage });
//starts server - listen for requests
app.listen(4000);

//specify view engine
app.set('view engine', 'ejs');

//make styles folder public
app.use(express.static('styles'));
app.use(express.static('images'));
app.use(express.static('imgs_audio'));
app.use(express.static('fontawesome/css'));
app.use(express.static('fontawesome'));
app.use(morgan('dev'));//idk

app.use(bodyparser.json())
app.use(bodyparser.urlencoded({
    extended: true
}))

app.use(express.json());//important for inserting data
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(session({
    secret: uuidv4(),
    resave: false,
    saceUninitialized: false

}));

app.use('/route', router);

//requests
app.get('/', (req, res) => {
    con.query('SELECT * FROM beat, product where beat.product_id = product.id', (err, results) => {

        if (req.session.login) {


            if (err)
                console.log(err);


            res.render('index', { beats: results, pageTitle: 'home', user: req.session.user, login: req.session.login, userId: req.session.userId });
        } else {
            res.render('index', { beats: results, pageTitle: 'home', user: req.session.user, login: req.session.login });
        }


    })




})

app.get('/user-profile', (req, res) => {
    con.query("select * from site_user where id = ? limit 1", [req.session.userId], (err, result) => {
        if (err) {
            console.log(err)
        } else {
            console.log(result);
            const usr = result[0];
            res.render('user-profile', { pageTitle: "user-profile", usr: usr, user: req.session.user, login: req.session.login });
        }
    })
})
app.get('/about', (req, res) => {

    res.render('about', { pageTitle: 'about', user: req.session.user, login: req.session.login });


})
app.get('/all-beats', (req, res) => {
    con.query('select * from beat', (err, results) => {
        if (err)
            console.log(err);
        else
            res.render('all-beats', { beats: results, pageTitle: 'all-beats', user: req.session.user, login: req.session.login });
    })


})

app.get('/contact', (req, res) => {

    res.render('contact', { pageTitle: 'contact', user: req.session.user, login: req.session.login });


})

app.get('/free-beats', (req, res) => {

    res.render('free-beats', { pageTitle: 'free-beats', user: req.session.user, login: req.session.login });


})
app.get('/user-settings', (req, res) => {
    if (req.session.login) {
        con.query("select * from site_user where id = ? limit 1", [req.session.userId], (err, result) => {
            if (err) {
                console.log(err)
            }
            console.log(result);
            userDetails = result[0];
            console.log(userDetails);
            res.render('user-settings', { pageTitle: 'user-setting', user: req.session.user, login: req.session.login, userDetails: userDetails });
        })
    } else {
        res.redirect('user-login');
    }




})

app.post('/edit-info', (req, res) => {
    con.query("update site_user set username = ?, email_address= ? where id = ?", [req.body.username, req.body.email, req.session.userId], (err, result) => {
        if (err) {
            console.log(err)
        }
        console.log('edit successful!!');
        req.session.user = req.body.username;
        res.redirect('user-settings');
    })
})



app.get('/more-info', (req, res) => {

    res.render('more-info', { pageTitle: 'more-info', user: req.session.user, login: req.session.login });


})

app.get('/shopping-cart', (req, res) => {
    con.query('SELECT * FROM beat, product, shopping_cart, shopping_cart_item where beat.product_id = product.id and shopping_cart.user_id = ? and shopping_cart.id = shopping_cart_item.cart_id and shopping_cart_item.product_id = product.id', [req.session.userId], (err, results) => {

        if (req.session.login) {


            if (err) { console.log(err); }




            // req.session.cartId = results[0].cart_id;

            res.render('shopping-cart', { cartItems: results, cartId: req.session.cartId, pageTitle: 'shopping-cart', user: req.session.user, login: req.session.login, userId: req.session.userId });




        } else {
            res.render('user-login', { beats: results, pageTitle: 'home', user: req.session.user, login: req.session.login });
        }


    })

})

app.post('/delete-item', (req, res) => {
    const itemId = req.body.itemId;
    const cartId = req.session.cartId;

    console.log("Item Id: ", itemId);
    console.log("cart id: ", cartId);
    con.query('delete from shopping_cart_item where cart_id = ? and id = ?', [parseInt(cartId), parseInt(itemId)], (err, result) => {
        if (err) {
            console.log(err);
        }
        console.log("AAAA");
        res.redirect('/shopping-cart');
    })
})

app.post('/add-to-cart', (req, res) => {

    if (req.session.login) {
        const beatId = req.body.beatId;
        con.query('insert into shopping_cart_item(cart_id, product_id) values(?,?)', [req.session.cartId, beatId], (err, result) => {
            if (err) {
                console.log(err);
            }
            console.log("Cart ID:", req.session.cartId);
            console.log("Product ID: ", beatId);
            res.redirect('/#container-beats');
        })
    }
    else {
        res.redirect('user-login');
    }

})
let value = {
    userName: "",
    email: "",
    password: "",
    confirmPassword: ""

}
let error = {
    userName: "",
    email: "",
    password: "",
    confirmPassword: ""

};
app.get('/user-signup', (req, res) => {
    error = {
        userName: "",
        email: "",
        password: "",
        confirmPassword: ""

    };
    value = {
        userName: "",
        email: "",
        password: "",
        confirmPassword: ""

    }



    res.render('user-signup', { pageTitle: 'user-signup', error: error, value });
})

app.post('/user-signup-request', async (req, res) => {
    const userName = req.body.signupUsername;
    const email = req.body.signupEmail;
    const password = req.body.signupPassword;
    const confirmPassword = req.body.signupConfirmPassword;

    // Check if the username already exists
    con.query("SELECT * FROM site_user WHERE username = ?", [userName], async (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send("An error occurred while processing your request");
        }
        if (result.length > 0) {
            console.log('username already taken');
            error.userName = "Username already taken";
            value = {
                userName: userName,
                email: email,
                password: password,
                confirmPassword: confirmPassword

            }
            return res.redirect("/user-signup-re");
        } else {
            error.userName = "";
        }

        con.query("SELECT * FROM site_user WHERE email_address = ?", [email], async (emailErr, emailResult) => {
            if (emailErr) {
                console.log(err);
                return res.status(500).send("An error occurred while processing your request");
            }
            if (emailResult.length > 0) {
                console.log('email already taken')
                error.email = "Email already taken";
                value = {
                    userName: userName,
                    email: email,
                    password: password,
                    confirmPassword: confirmPassword

                }
                return res.redirect("/user-signup-re");
            } else {
                error.email = "";
            }

            // If the username is available, proceed to check the password
            if (confirmPassword != password) {
                console.log("Password not matching");
                error.confirmPassword = "Password not matching";
                value = {
                    userName: userName,
                    email: email,
                    password: password,
                    confirmPassword: confirmPassword

                }
                return res.redirect("/user-signup-re");
            } else {
                error.confirmPassword = "";
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);
            error = {
                userName: "",
                email: "",
                password: "",
                confirmPassword: ""

            };
            value = {
                userName: "",
                email: "",
                password: "",
                confirmPassword: ""

            }
            // Insert the user into the database
            con.query('INSERT INTO site_user(username, email_address, password) VALUES (?, ?, ?)', [userName, email, hashedPassword], (err, result) => {
                if (err) {
                    console.log(err);
                    return res.status(500).send("An error occurred while processing your request");
                } else {
                    return res.redirect("/user-login");
                }
            });

        })


    }
    );
});


app.get('/user-signup-re', (req, res) => {
    // error = {
    //     userName: "",
    //     email: "",
    //     password: "",
    //     confirmPassword: ""

    // };


    res.render('user-signup', { pageTitle: 'user-signup', error: error, value });
})



app.get('/user-login', (req, res) => {
    con.query("SELECT * FROM site_user", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.render('user-login', { pageTitle: 'user-login', siteUsers: result });

        }
    })

})


app.get('/admin-login', (req, res) => {
    con.query("SELECT * FROM admin", (err, result) => {
        if (err) {
            console.log(err);
        } else {
            res.render('admin-login', { pageTitle: 'user-login', siteUsers: result });
        }
    })

})


app.post('/subscribe-email', (req, res) => {
    const subName = req.body.subName;
    const subEmail = req.body.subEmail;
    const subConfirm = req.body.subConfirm;

    con.query("insert into email_sub(name, email) values(?, ?)", [subName, subEmail], (err, result) => {
        if (err) {
            console.log(err);
        }
        res.redirect('/');
    })
})



app.get('/admin-index', (req, res) => {
    if (req.session.adminLogin) {
        con.query("SELECT COUNT(*) AS numberOfBeats FROM beat", (err, beatResult) => {
            if (err) {
                console.log(err);
                return res.status(500).send("An error occurred while processing your request");
            }

            const numberOfBeats = beatResult[0].numberOfBeats;

            con.query("SELECT COUNT(*) AS numberOfProducts FROM product", (productErr, productResult) => {
                if (productErr) {
                    console.log(productErr);
                    return res.status(500).send("An error occurred while processing your request");
                }

                const numberOfProducts = productResult[0].numberOfProducts;

                con.query("SELECT COUNT(*) AS numberOfSiteUsers FROM site_user", (siteUserErr, siteUserResult) => {
                    if (siteUserErr) {
                        console.log(siteUserErr);
                        return res.status(500).send("An error occurred while processing your request");
                    }

                    const numberOfSiteUsers = siteUserResult[0].numberOfSiteUsers;

                    con.query("SELECT COUNT(*) AS numberOfShopOrder FROM PAYMENT", (shopOrderErr, shopOrderResult) => {
                        if (shopOrderErr) {
                            console.log(shopOrderErr);
                            return res.status(500).send("An error occurred while processing your request");
                        }

                        const numberOfShopOrder = shopOrderResult[0].numberOfShopOrder;

                        con.query("SELECT COUNT(*) AS numberOfSample FROM sample_pack", (sampleErr, sampleResult) => {
                            if (sampleErr) {
                                console.log(sampleErr);
                                return res.status(500).send("An error occurred while processing your request");
                            }

                            const numberOfSample = sampleResult[0].numberOfSample;

                            con.query("select sum(amount) as sumAmount from payment", (sumErr, sumResult) => {
                                if (sumErr) {
                                    console.log(sumErr);
                                    res.status(500).send("An error occurred while processing your request");
                                }
                                const sumAmount = sumResult[0].sumAmount;
                                res.render('admin-index', {
                                    pageTitle: 'admin-index',
                                    user: req.session.user,
                                    login: req.session.login,
                                    noBeat: numberOfBeats,
                                    noProduct: numberOfProducts,
                                    noSiteUsers: numberOfSiteUsers,
                                    noShopOrder: numberOfShopOrder,
                                    noSample: numberOfSample,
                                    sumAmount: sumAmount,
                                    admin: req.session.admin, adminLogin: req.session.adminLogin

                                });
                            })




                        });
                    });
                });
            });
        });
    } else {
        res.redirect('/admin-login')
    }
});



//ADMIN NAVIGATION SHIITTIITITITITI


app.get('/admin-beats', (req, res) => {
    if (req.session.adminLogin) {
        con.query("SELECT * FROM product, beat WHERE product.category_id = ? AND beat.category_id and product.id = beat.product_id", [3001], (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).send("An error occurred while processing your request");

            }
            res.render('admin-beats', { pageTitle: 'Beats', beats: result, admin: req.session.admin, adminLogin: req.session.adminLogin });

        })
    } else {
        res.redirect('/admin-login')

    }




})

app.get('/admin-sample-pack', (req, res) => {
    if (req.session.adminLogin) {
        res.render('admin-sample-pack', { pageTitle: 'Sample Packs', admin: req.session.admin, adminLogin: req.session.login });

    } else {
        res.redirect('/admin-login')

    }
})

app.get('/admin-customers', (req, res) => {
    if (req.session.adminLogin) {
        con.query("select * from customer, site_user where customer.site_user_id = site_user.id ", (err, result) => {
            if (err) {
                console.log(err);
            }
            res.render('admin-customers', { pageTitle: 'Customers', customers: result, admin: req.session.admin, adminLogin: req.session.adminLogin });
        })
    } else {
        res.redirect('/admin-login')
    }




})

app.get('/admin-payments', (req, res) => {
    if (req.session.adminLogin) {
        con.query("select * from payment", (err, result) => {
            if (err) {
                console.log(err);
            }
            res.render('admin-payments', { pageTitle: 'Payments', payments: result, admin: req.session.admin, adminLogin: req.session.adminLogin });

        })
    } else {
        res.redirect('/admin-login')
    }




})

app.get('/admin-contact', (req, res) => {
    if (req.session.adminLogin) {
        con.query("select * from contact", (err, result) => {
            if (err) {
                console.log(err)
            }
            res.render('admin-contact', { pageTitle: 'Messages', messages: result, admin: req.session.admin, adminLogin: req.session.adminLogin })
        })
    } else {
        res.redirect('/admin-login')
    }
})


app.get('/admin-sub', (req, res) => {
    if (req.session.adminLogin) {
        con.query("select * from email_sub", (err, result) => {
            if (err) {
                console.log(err)
            }
            res.render('admin-sub', { pageTitle: 'Email Subscriptions', subs: result, admin: req.session.admin, adminLogin: req.session.adminLogin })
        })
    } else {
        res.redirect('/admin-login')

    }
})

app.get('/admin-account', (req, res) => {
    if (req.session.adminLogin) {
        con.query("select * from admin where username = ? limit 1", [req.session.admin], (err, result) => {
            if (err) {
                console.log(err);
            }
            const adminDetails = result[0];
            console.log(adminDetails);
            res.render('admin-account', { pageTitle: 'Admin Account', admin: req.session.admin, adminLogin: req.session.login, adminDetails: adminDetails });
        })


    } else {
        res.redirect('/admin-login')

    }
})

app.post('/edit-admin-info', (req, res)=>{
    con.query("update admin set username = ?, email = ?", [req.body.username, req.body.email], (err, result)=>{
        if(err){
            console.log(err);
        }
        req.session.admin = req.body.username;
        res.redirect('/admin-account');
    })
})

app.post('/edit-admin-password', (req, res)=>{
    const newPassword = req.body.newPassword;
    const conPassword = req.body.conPassword;

    if(newPassword != conPassword){
        console.log("passwords not matching");
    }
    else{
    con.query("update admin set password = ?", [newPassword], (err, result)=>{
        if(err){
            console.log(err);
        }
        
        res.redirect('/admin-account');
    })}
})




const { getAudioDurationInSeconds } = require('get-audio-duration');

// Function to convert seconds to minutes:seconds format
function formatDuration(durationInSeconds) {
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// BEAT UPLOAD
app.post('/upload-beat', upload.fields([{ name: 'beatUpload', maxCount: 1 }, { name: 'beatUploadNotFree', maxCount: 1 }, { name: 'beatImage', maxCount: 1 },]), (req, res) => {
    console.log(req.body);

    const beatName = req.body.beatName;
    const beatBpm = req.body.beatBpm;
    const beatPrice = req.body.beatPrice;

    const beatUploadFileNotFree = req.files['beatUploadNotFree'][0];
    const beatUploadFile = req.files['beatUpload'][0]; // Assuming maxCount is 1
    const beatImageFile = req.files['beatImage'][0]; // Assuming maxCount is 1

    getAudioDurationInSeconds(beatUploadFile.path).then((duration) => {
        const formattedDuration = formatDuration(duration);
        console.log("Duration:", formattedDuration);

        // Insert beat information into the database
        con.query("INSERT INTO product (name, tag_id, category_id, active, price, content_path, img_path, paid_content_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [beatName, 1, 3001, 1, beatPrice, beatUploadFile.filename, beatImageFile.filename, beatUploadFileNotFree.filename],
            (productErr, productResult) => {
                if (productErr) {
                    console.log(productErr);
                    return res.status(500).send("An error occurred while processing your request");
                }

                con.query("SELECT LAST_INSERT_ID() as lastId", (fetchIdErr, fetchIdResult) => {
                    if (fetchIdErr) {
                        console.log(fetchIdErr);
                        return res.status(500).send("An error occurred while processing your request");
                    }
                    const productId = fetchIdResult[0].lastId;

                    con.query("INSERT INTO beat (bpm, duration, product_id, category_id) VALUES (?, ?, ?, ?)",
                        [beatBpm, formattedDuration, productId, 3001],
                        (uploadBeatErr, uploadBeatResult) => {
                            if (uploadBeatErr) {
                                console.log(uploadBeatErr);
                                return res.status(500).send("An error occurred while processing your request");
                            }
                            res.redirect('/admin-beats');
                        });
                });
            });
    }).catch((error) => {
        console.error("Error getting audio duration:", error);
        return res.status(500).send("An error occurred while processing your request");
    });
});

app.post('/delete-beat', (req, res) => {
    const beatId = req.body.beatId;
    console.log("beat id: ", beatId);
    con.query("DELETE FROM beat where product_id = ?", [beatId], (delErr, delResult) => {
        if (delErr) {
            console.log(delErr)
        }

        con.query("DELETE FROM product where id = ?", [beatId], (delErr2, delResult2) => {
            if (delErr2) {
                console.log(delErr2)
            }
            res.redirect('/admin-beats');

        })
    });

})


app.post('/post', (req, res) => {
    const name = req.body.name;
    const email = req.body.email;



    con.query('insert into emial_sub(name, email) values(?,?)', [name, email], (err, result) => {
        if (err)
            console.log(err);
        else
            res.redirect("/");
    });



})

// app.post('/user-signup-request', (req, res) => {

//     const userName = req.body.signupUsername;
//     const email = req.body.signupEmail;
//     const password = req.body.signupPassword;
//     const confirmPassword = req.body.signupConfirmPassword;

//     if (confirmPassword != password) {
//         console.log("Password not matching");
//         error.confirmPassword = "Password not matching";
//         res.redirect("/user-signup-re");


//     }
//     else {
//         con.query('insert into site_user(username, email_address, password) values(?,?,?)', [userName, email, password], (err, result) => {
//             if (err)
//                 console.log(err);
//             else
//                 res.redirect("/");
//         })
//     }
// })


app.post('/create-checkout-session', async (req, res) => {

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: req.body.items.map(item => {
                const storeItem = storeItems.get(item.id)
                return {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: storeItem.name
                        },
                        unit_amount: storeItem.priceInCents
                    },
                    quantity: item.quantity
                }
            }),
            success_url: '${process.env.SERVER_URL}/success.html',
            success_url: '${process.env.SERVER_URL}/cancel.html'
        })
        res.json({ url: session.url })
    } catch (e) {
        res.status(500).json({ error: e.message });
    }


})
const razorpay = new Razorpay({
    key_id: 'rzp_test_daoLopIZNUyaRK',
    key_secret: 'fefTUjSKoqkDqoyjlQcYHTpP'
});

app.post('/checkout', (req, res) => {
    console.log(req.body.productIds);
    console.log(req.session.userId);
    req.session.productIds = req.body.productIds;

    const amount = req.body.amount;
    req.session.amount = amount;// Make sure to pass the total amount from the client
    const currency = 'USD'; // Assuming you're using USD

    const options = {
        amount: amount * 100, // Razorpay expects amount in paise, so multiply by 100
        currency: currency
    };

    razorpay.orders.create(options, (err, order) => {
        if (err) {
            console.error('Error creating order:', err);
            res.status(500).json({ error: 'Failed to create Razorpay order' });
        } else {
            console.log('Order created successfully:', order);
            res.json(order);
        }
    });
});

app.get('/success', async (req, res) => {


    try {
        const productQueries = req.session.productIds.map(productId => {
            return new Promise((resolve, reject) => {
                con.query("SELECT * FROM product WHERE id = ?", [productId], (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });
        });

        const productResults = await Promise.all(productQueries);

        // Check if productResults is empty
        if (productResults.length === 0) {
            console.log('No product details found');
        } else {
            console.log('Product details:', productResults);
        }


        con.query("select * from customer where site_user_id = ? limit 1", [req.session.userId], (cusErr, cusResult) => {
            if (cusErr) {
                console.log(cusErr);
            }
            if (cusResult.length === 0) {
                console.log('inserting customer');
                con.query("insert into customer(site_user_id) values(?)", [req.session.userId], (insertCusErr, insertCusResult) => {
                    if (insertCusErr) {
                        console.log(insertCusErr);
                    }
                    con.query("SELECT * FROM customer WHERE site_user_id = ? LIMIT 1", [req.session.userId], (fetchCusErr, fetchCusResult) => {
                        if (fetchCusErr) {
                            console.log(fetchCusErr);

                            return;
                        }

                        if (fetchCusResult.length === 0) {
                            console.log("No customer found for the given user ID");

                            return;
                        }

                        const customer = fetchCusResult[0];

                        console.log("Customer ID: ", customer.id);

                        con.query("INSERT INTO payment(amount, customer_id) VALUES (?, ?)", [req.session.amount, customer.id], (payErr, payResult) => {
                            if (payErr) {
                                console.log(payErr);

                                return;
                            }


                            res.render('success', { pageTitle: 'Success', productDetails: productResults });
                        });
                    });
                })
            } else {
                con.query("SELECT * FROM customer WHERE site_user_id = ? LIMIT 1", [req.session.userId], (fetchCusErr, fetchCusResult) => {
                    if (fetchCusErr) {
                        console.log(fetchCusErr);

                        return;
                    }

                    if (fetchCusResult.length === 0) {
                        console.log("No customer found for the given user ID");

                        return;
                    }

                    const customer = fetchCusResult[0];

                    console.log("Customer ID: ", customer.id);

                    con.query("INSERT INTO payment(amount, customer_id) VALUES (?, ?)", [req.session.amount, customer.id], (payErr, payResult) => {
                        if (payErr) {
                            console.log(payErr);

                            return;
                        }


                        res.render('success', { pageTitle: 'Success', productDetails: productResults });
                    });
                });


            }
        })

    } catch (error) {
        console.error('Error retrieving product details:', error);
        res.status(500).send('An error occurred while processing your request.');
    }
});



app.post('/send-message', (req, res) => {
    const conName = req.body.contactName;
    const conEmail = req.body.contactEmail;
    const conSubj = req.body.contactSubj;
    const conMsg = req.body.contactMsg;

    con.query("insert into contact(name, email, subj, message) values(?, ?, ?, ?)", [conName, conEmail, conSubj, conMsg], (err, result) => {
        if (err) {
            console.log(err)
        }
        res.redirect('/contact');
    })

})



app.post('/user-login-request', (req, res) => {


})

app.use((req, res) => {
    res.status(404).render('404');
})


