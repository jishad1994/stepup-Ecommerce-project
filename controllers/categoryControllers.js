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
        res.render("categories", {
            cat: categoryData,
            currentPage: page,
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
        console.log(`name:${name} and description :${description}`);

        if (!name || !description) {
            return res.status(400).json({ success: false, message: "please fill the necessary datails" });
        }

        const isCategoryExists = await Category.findOne({ name });

        if (isCategoryExists) {
            return res.status(400).json({ success: false, message: "category already exists" });
        }

        const newcategory = new Category({ name, description });
        await newcategory.save();
        res.status(200).json({ success: true, message: "category added successfully" });
    } catch (error) {
        console.log("error while adding category", error);
        res.redirect("/admin/errorpage");
    }
};
//unlisting category

const categoryUnlist = async (req, res) => {
    try {
        const categoryName = req.query.name;

        const result = await Category.updateOne({ name: categoryName }, { $set: { isListed: false } });

        res.redirect("/admin/categories");
    } catch (error) {
        console.log("error while unlisting the category");
        res.status(400).json({ success: false, message: "unlisting failed" });
    }
};

//unlisting category

const categoryList = async (req, res) => {
    try {
        const categoryName = req.query.name;

        const result = await Category.updateOne({ name: categoryName }, { $set: { isListed: true } });

        res.redirect("/admin/categories");
    } catch (error) {
        console.log("error while listing the category");
        res.status(400).json({ success: false, message: "listing failed" });
    }
};

//loda Updatecategory

const loadUpdateCategory = async (req, res) => {
    const name = req.query.name;

    try {
        const category = await Category.findOne({ name });

        if (!category) {
            return res.status(500).json({ success: false, message: "no category found" });
        }

        res.render("updatecategory", { category });
    } catch (error) {
        console.log("error while fetching category info", error.message);
        res.status(500).json({ success: false, message: "error while fetching category Info" });
    }
};

//update category
const updateCategory = async (req, res) => {
    try {
        const { originalName, name, description } = req.body;

        // Input validation
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: "Name and description are required",
            });
        }

        // Check if the new name already exists (excluding current category)
        const existingCategory = await Category.findOne({
            name: name,
        });
        console.log(existingCategory);

        if (existingCategory && existingCategory?.name !== originalName) {
            return res.status(400).json({
                success: false,
                message: "A category with this name already exists",
            });
        }

        // Find the original category
        const category = await Category.findOne({ name: originalName });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        // Update the category
        const updateResult = await Category.updateOne(
            { name: originalName },
            {
                $set: {
                    name,
                    description,
                },
            }
        );

        // Check if update was successful
        if (updateResult.modifiedCount === 0) {
            return res.status(500).json({
                success: false,
                message: "Failed to update category",
            });
        }

        res.status(200).json({
            success: true,
            message: "Category updated successfully",
        });
    } catch (error) {
        console.error("Error while updating category:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// soft delete or undo category
const deleteOrUndoCategory = async (req, res) => {
    try {
        const name = req.query.name;

        let category = await Category.findOne({ name });

        if (category.isDeleted) {
            await Category.updateOne({ name: name }, { $set: { isDeleted: false } });

            return res.redirect("/admin/categories");
        } else {
            await Category.updateOne({ name: name }, { $set: { isDeleted: true } });

            res.redirect("/admin/categories");
        }
    } catch (error) {
        console.log("error while softdeleting category", error.message);
        res.render("errorpage");
    }
};


module.exports = {
    categoryInfo,
    addCategory,
    categoryUnlist,
    categoryList,
    updateCategory,
    loadUpdateCategory,
    deleteOrUndoCategory,
    
};
