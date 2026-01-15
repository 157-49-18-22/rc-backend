const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const Balance = require('../models/balance');
const hitlog = require('../models/hitlog');
exports.getUserRole = async (req, res) => {
  try {
    
    const token = req.headers['authorization']?.split(' ')[1]; 
    if (!token) {
      return res.status(401).json({ message: "Access denied, no token" });
    }
    console.log(token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    const user = await User.findById(decoded.userId).select('role');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send back the user's role
    res.json({ role: user.role });
  } catch (error) {
    res.status(400).json({ message: "Invalid token" });
  }
};
// Register User
exports.register = async (req, res) => {
  const {email, mobileNo, firstname, lastname, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const existingMobile = await User.findOne({ mobileNo });
    if (existingMobile) {
      return res.status(400).json({ message: 'User already exists with this mobile number' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, mobileNo, firstname, lastname, password: hashedPassword });

    await newUser.save();
    let balance = await Balance.findOne({ userId: newUser._id });
    if (!balance) {
      balance = new Balance({
        userId: newUser._id,
        balance: 0,  // Default balance is 0 if not found
      });

      await balance.save();  // Save the new balance document
    }
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Login User
exports.login = async (req, res) => {
  const {mobileNo, password } = req.body;
  try {
    const user = await User.findOne({ mobileNo });
    if (!user) {
      return res.status(400).json({ message: 'Invalid mobileNo' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
exports.adminChangePassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ message: 'User ID and new password are required.' });
  }

  try {
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true, select: '-password' } 
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
// exports.forgotPassword = async (req, res) => {
//   const { email } = req.body;
//   try {
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Generate a password reset token
//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     user.resetPasswordToken = hashedResetToken;
//     user.resetPasswordExpiry = Date.now() + 3600000; // 1 hour expiry
//     await user.save();

//     // Send the reset token to the user's email (for demo purposes, we are skipping real email sending)
//     const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

//     // Here you would normally send an email via nodemailer
//     // Example email setup:
//     const transporter = nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASSWORD
//       }
//     });

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: 'Password Reset Request',
//       text: `Click the following link to reset your password: ${resetUrl}`
//     };

//     transporter.sendMail(mailOptions, (err, info) => {
//       if (err) {
//         console.error('Error sending email:', err);
//         return res.status(500).json({ message: 'Error sending email' });
//       }
//       res.status(200).json({ message: 'Password reset email sent' });
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
// exports.resetPassword = async (req, res) => {
//   const { token, newPassword } = req.body;
//   try {
//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
//     const user = await User.findOne({
//       resetPasswordToken: hashedToken,
//       resetPasswordExpiry: { $gt: Date.now() } // Ensure token is not expired
//     });

//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired token' });
//     }

//     // Hash the new password and save it
//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     user.password = hashedPassword;
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpiry = undefined;
//     await user.save();

//     res.status(200).json({ message: 'Password successfully reset' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
exports.searchUsers = async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;

  try {
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { firstname: { $regex: query, $options: 'i' } },
        { mobileNo: { $regex: query, $options: 'i' } }
      ]
    })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('firstname lastname mobileNo email');

    if (users.length === 0) {
      return res.status(404).json({ message: 'No users found' });
    }

    const totalUsers = await User.countDocuments({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { firstname: { $regex: query, $options: 'i' } },
        { mobileNo: { $regex: query, $options: 'i' } }
      ]
    });

    // 📅 Get current and previous month boundaries
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    // Optional: Clean up old logs (older than 2 months)
    await hitlog.deleteMany({ timestamp: { $lt: twoMonthsAgo } });

    // 📊 Fetch hit counts for current and previous month per user
    const userIds = users.map(u => u._id);
    const currentHits = await hitlog.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          timestamp: { $gte: currentMonthStart }
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      }
    ]);

    const prevHits = await hitlog.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          timestamp: { $gte: prevMonthStart, $lt: currentMonthStart }
        }
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 }
        }
      }
    ]);

    const currentHitMap = new Map(currentHits.map(h => [h._id.toString(), h.count]));
    const prevHitMap = new Map(prevHits.map(h => [h._id.toString(), h.count]));

    // 🔄 Attach balance + hit counts
    const usersWithBalanceAndHits = await Promise.all(users.map(async (user) => {
      const balanceDoc = await Balance.findOne({ userId: user._id }).select('balance');
      const balance = balanceDoc ? balanceDoc.balance : 0;
      const currentMonthHits = currentHitMap.get(user._id.toString()) || 0;
      const previousMonthHits = prevHitMap.get(user._id.toString()) || 0;

      return {
        ...user.toObject(),
        balance,
        currentMonthHits,
        previousMonthHits
      };
    }));

    res.json({
      users: usersWithBalanceAndHits,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};
// exports.searchUsers = async (req, res) => {
//   const { query, page = 1, limit = 10 } = req.query;  // Default to page 1 and limit 10

//   try {
//     // Fetch users by username or email
//     const users = await User.find({
//       $or: [
//         { email: { $regex: query, $options: 'i' } },
//         { firstname: { $regex: query, $options: 'i' } },  // Allow searching by mobileNo
//         { mobileNo: { $regex: query, $options: 'i' } }  // Allow searching by mobileNo
//       ]
//     })
//       .skip((page - 1) * limit)  // Pagination: skip previous pages
//       .limit(parseInt(limit))    // Limit results per page
//       .select('firstname lastname mobileNo email ')  // Only select username and email fields from the User model

//     if (users.length === 0) {
//       return res.status(404).json({ message: 'No users found' });
//     }

//     // Get the total number of users matching the search query
//     const totalUsers = await User.countDocuments({
//       $or: [
//         { email: { $regex: query, $options: 'i' } },
//         { firstname: { $regex: query, $options: 'i' } },
//         { mobileNo: { $regex: query, $options: 'i' } }
//       ]
//     });

//     // Fetch the balance for each user
//     const usersWithBalance = await Promise.all(users.map(async user => {
//       const balance = await Balance.findOne({ userId: user._id }).select('balance');
//       return { ...user.toObject(), balance: balance ? balance.balance : 0 };
//     }));

//     res.json({
//       users: usersWithBalance,
//       totalUsers,
//       totalPages: Math.ceil(totalUsers / limit),  // Calculate total pages
//       currentPage: parseInt(page),  // Return current page number
//     });
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     res.status(500).json({ message: 'Error fetching users', error: error.message });
//   }
// };
exports.deleteUser = async (req, res) => {
  const userId = req.params.id; // Get user ID from URL params

  try {
    // Find the user to delete
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Optionally, delete user's balance from the Balance collection
    // await Balance.findOneAndDelete({ userId: user._id });

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};