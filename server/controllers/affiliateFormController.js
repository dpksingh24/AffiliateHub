const { ObjectId } = require('mongodb');

const createAffiliateForm = async (req, res, db) => {

    try {
        const { shop } = req.query;
        const { name, description, fields, status } = req.body;

        if(!shop){
            return res.status(400).json({
                success: false,
                error: 'Shop parameter is required'
            });
        }

        // dublicate form name if it already exists
        const existingForm = await db.collection('affiliate_forms').findOne({ name: name.trim(), shop });
        if(existingForm){
            return res.status(400).json({
                success: false,
                error: 'Affiliate form name already exists'
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Form name is required' 
            });
        }

        // form submisson
        const newForm = {
            shop,
            name: name.trim(),
            description: description.trim(),
            fields: fields || [],
            status: status || 'Draft',
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const result = await db.collection('affiliate_forms').insertOne(newForm);

        return res.status(201).json({
            success: true,
            message: 'Affiliate form created successfully',
            form: {
                ...newForm,
                id: result.insertedId.toString(),
                _id: result.insertedId
            }
        });

    } catch (error) {
        console.error('Error creating affiliate form:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create affiliate form',
            message: error.message
        });
    }

}

const getAffiliateForms = async (req, res, db) => {
    try {
        const { shop } = req.query;

        if (!shop) {
            return res.status(400).json({
                success: false,
                error: 'Shop parameter is required'
            });
        }

        // Get all affiliate forms for this shop
        const forms = await db.collection('affiliate_forms')
            .find({ shop })
            .sort({ createdAt: -1 })
            .toArray();

        // Get submission counts for all forms
        const formIds = forms.map(f => f._id.toString());
        
        const submissionCounts = await db.collection('affiliate_form_submissions')
            .aggregate([
                {
                    $match: {
                        formId: { $in: formIds }
                    }
                },
                {
                    $group: {
                        _id: '$formId',
                        count: { $sum: 1 }
                    }
                }
            ])
            .toArray();

        // Create a map of formId -> count
        const countMap = {};
        submissionCounts.forEach(item => {
            countMap[item._id] = item.count;
        });

        // Add submission counts to forms
        const formsWithCounts = forms.map(form => ({
            ...form,
            _id: form._id.toString(),
            totalSubmissions: countMap[form._id.toString()] || 0
        }));

        res.json({
            success: true,
            forms: formsWithCounts
        });
    } catch (error) {
        console.error('Error fetching affiliate forms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch affiliate forms',
            message: error.message
        });
    }
};

const getAffiliateFormById = async (req, res, db) => {
    try {
        const { id } = req.params;
        const { shop } = req.query;

        if(!shop){
            return res.status(400).json({
                success: false,
                error: 'Shop parameter is required'
            });
        }

        const { ObjectId } = require('mongodb');
        let form;
        try {
            form = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(id),
                shop
            });
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid affiliate form ID format' 
            });
        }

        if(!form){
            return res.status(404).json({ 
                success: false, 
                error: 'Affiliate form not found' 
            });
        }

        return res.status(200).json({
            success: true,
            form
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch affiliate form',
            message: error.message 
          });
    }
}

// update pending affiliate form
const updateAffiliateForm = async (req, res, db) => {
    try {
        const { id } = req.params;
        const { shop } = req.query;
        const { name, description, fields, status } = req.body;

        if(!shop){
            return res.status(400).json({
                success: false,
                error: 'Shop parameter is required'
            });
        }

        // Validate form ID
        let existingForm;
        try {
            existingForm = await db.collection('affiliate_forms').findOne({
                _id: new ObjectId(id),
                shop
            });
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid affiliate form ID format' 
            });
        }

        if(!existingForm){
            return res.status(404).json({ 
                success: false, 
                error: 'Affiliate form not found' 
            });
        }

        // Check for duplicate form name (excluding current form)
        if (name && name.trim() !== existingForm.name) {
            const duplicateForm = await db.collection('affiliate_forms').findOne({ 
                name: name.trim(), 
                shop,
                _id: { $ne: new ObjectId(id) }
            });
            
            if(duplicateForm){
                return res.status(400).json({
                    success: false,
                    error: 'Affiliate form name already exists'
                });
            }
        }

        // Validate name if provided
        if (name !== undefined && !name.trim()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Form name cannot be empty' 
            });
        }

        // Prepare update object
        const updateData = {
            updatedAt: new Date()
        };

        if (name !== undefined) {
            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description.trim(); // keep it even if empty
        }

        if (fields !== undefined) {
            updateData.fields = fields;
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        // Update the form
        const result = await db.collection('affiliate_forms').updateOne(
            { _id: new ObjectId(id), shop },
            { $set: updateData }
        );

        if(result.modifiedCount === 0 && result.matchedCount === 0){
            return res.status(404).json({ 
                success: false, 
                error: 'Failed to update affiliate form' 
            });
        }

        // Fetch updated form
        const updatedForm = await db.collection('affiliate_forms').findOne({
            _id: new ObjectId(id)
        });

        return res.status(200).json({
            success: true,
            message: 'Affiliate form updated successfully',
            form: updatedForm
        });
    } catch (error) {
        console.error('Error updating affiliate form:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update affiliate form',
            message: error.message
        });
    }
};

const deleteAffiliateForm = async (req, res, db) => {
    try {
        const { id } = req.params;
        const { shop } = req.query;

        if(!shop){
            return res.status(400).json({
                success: false,
                error: 'Shop parameter is required'
            });
        }
        
        const { ObjectId } = require('mongodb');
        let result;
        try {
            result = await db.collection('affiliate_forms').deleteOne({
                _id: new ObjectId(id),
                shop
            });
        } catch (error) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid affiliate form ID format' 
            });
        }

        if(result.deletedCount === 0){
            return res.status(404).json({ 
                success: false, 
                error: 'Affiliate form not found' 
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Affiliate form deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting affiliate form:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete affiliate form',
            message: error.message
        });
    }
}


module.exports = {
    createAffiliateForm,
    getAffiliateForms,
    getAffiliateFormById,
    updateAffiliateForm,
    deleteAffiliateForm
};