const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const mysql = require('mysql');

const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'beat_store'
});

con.connect(function (err) {
    if (err) throw err;
    console.log('Connected');
});

const userLoginError = 'Invalid username or password';

// Login user
router.post('/login', (req, res) => {
    const loginUsername = req.body.loginUsername;
    const loginPassword = req.body.loginPassword;

    con.query("SELECT * FROM site_user WHERE username = ?", [loginUsername], (err, result) => {
        if (err) {
            console.error(err); // Log the actual error
            res.redirect("/user-login"); // Redirect on error
        } else {
            if (result.length === 0) {
                console.log('Invalid username or password ');
                res.redirect("/user-login");
            } else {
                const hashedPassword = result[0].password;

                bcrypt.compare(loginPassword, hashedPassword, (compareErr, compareResult) => {
                    if (compareErr) {
                        console.error(compareErr); // Log the actual error
                        res.redirect("/user-login");
                    } else if (compareResult && loginUsername === req.body.loginUsername) {
                        req.session.user = loginUsername;
                        req.session.login = true;
                        req.session.userId = result[0].id;

                        con.query('SELECT * FROM shopping_cart WHERE user_id = ?', [req.session.userId], (cartErr, cartResults) => {
                            if (cartErr) {
                                console.error(cartErr); // Log the actual error
                                res.redirect("/user-login");
                            } else {
                                if (cartResults.length > 0) {
                                    req.session.cartId = cartResults[0].id;
                                    res.redirect('/');
                                } else {
                                    con.query('INSERT INTO shopping_cart (user_id) VALUES (?)', [req.session.userId], (insertErr, insertResult) => {
                                        if (insertErr) {
                                            console.error(insertErr); // Log the actual error
                                            res.redirect("/user-login");
                                        } else {
                                            con.query('SELECT * FROM shopping_cart WHERE user_id = ?', [req.session.userId], (cartFetchErr, cartFetchResult) => {
                                                if (cartFetchErr) {
                                                    console.error(cartFetchErr); // Log the actual error
                                                } else {
                                                    req.session.cartId = cartFetchResult[0].id; // Use cartFetchResult instead of cartResults
                                                    res.redirect('/');
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    } else {
                        console.log("Invalid username or password");
                        res.redirect("/user-login");
                    }
                });
            }
        }
    });
});


router.post('/edit-password', (req, res) => {
    const { newPassword, conPassword } = req.body;

    if (newPassword !== conPassword) {
        console.log("Passwords do not match");
        return res.status(400).send("Passwords do not match");
    }

    con.query('SELECT * FROM site_user WHERE id = ? LIMIT 1', [req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Internal Server Error");
        }

        if (result.length === 0) {
            console.log("User not found");
            return res.status(404).send("User not found");
        }

        const currentPassword = result[0].password;

        bcrypt.compare(newPassword, currentPassword, (compareErr, compareResult) => {
            if (compareErr) {
                console.error(compareErr);
                return res.status(500).send("Internal Server Error");
            }

            if (compareResult) {
                console.log("New password cannot be the same as the current password");
                return res.status(400).send("New password cannot be the same as the current password");
            }

            bcrypt.hash(newPassword, 10, (hashErr, hashedPassword) => {
                if (hashErr) {
                    console.error(hashErr);
                    return res.status(500).send("Internal Server Error");
                }

                con.query("UPDATE site_user SET password = ? WHERE id = ?", [hashedPassword, req.session.userId], (updateErr) => {
                    if (updateErr) {
                        console.error(updateErr);
                        return res.status(500).send("Internal Server Error");
                    }

                    console.log("Password edit successful");
                    res.redirect('/user-login');
                });
            });
        });
    });
});

// Admin login
router.post('/admin-login', (req, res) => {
    const loginUsername = req.body.loginUsername;
    const loginPassword = req.body.loginPassword;

    con.query("SELECT * FROM admin WHERE username = ?", [loginUsername], (err, result) => {
        if (err) {
            console.log("error");
        } else {
            if (result.length === 0) {
                console.log('Invalid username or password');
                return res.redirect("/admin-login");
            } else {
                const hashedPassword = result[0].password; // Temporarily not hashed

                if (loginPassword == hashedPassword && loginUsername === req.body.loginUsername) {
                    req.session.admin = loginUsername;
                    req.session.adminLogin = true;
                    
                    return res.redirect('/admin-index');
                } else {
                    console.log("Invalid username or password");
                    return res.redirect("/admin-login");
                }
            }
        }
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.session.user = null;
    req.session.login = false;
    req.session.userId = null;
    res.redirect('/');


});

router.get('/admin-logout', (req, res) => {
    req.session.admin = null;
    req.session.adminLogin = false;

    res.redirect('/admin-login');


});

module.exports = router;
