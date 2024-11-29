const Category = require("../model/categoryModel");

const categoryInfo = async (req, res) => {
    try {
        //paging logic for how many data to fetch and display
        const page = req.query.page;
        const limit = 5;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);
        res.render("category", {
            cat: categoryData,
            currentpage: page,
            totalPages,
            totalCategories,
        });
    } catch (error) {
        console.log("error while loading category page", error);
        res.redirect("/admin/errorpage");
    }
};

//add category

const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const isCategoryExists = await Category.findOne({ name });

        if (isCategoryExists) {
            return res.status(400).json({ success: false, error: "category already exists" });
        }

        const newcategory = new Category({ name, description });
        await newcategory.save();

        
    } catch (error) {
        console.log("error while adding category", error);
        res.redirect("/admin/errorpage");
    }
};

module.exports = {
    categoryInfo,
};
