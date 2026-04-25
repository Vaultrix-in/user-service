require('dotenv').config();
const connectDB  = require('./config/db');
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const User       = require('./models/User');
const Service    = require('./models/Service');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'vaultrix-super-secret-key';
const WALLET_URL = process.env.WALLET_SERVICE_URL || 'http://127.0.0.1:3003';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'vaultrix-internal-token';
const DEFAULT_SERVICE_BACKGROUND = 'https://images.openai.com/static-rsc-4/aMF6yfUacXWNU326dNEtZOm0Epe1hDm9ot18K-e8hLSVuXUFPwPGefc6ioebEyCOUvSfG1x15R5MWEoPeAsdck3B6FSgyzu9QnzibFNBgEF-M9sgzq25OA0ed0O6uxeru5nCuyt0-kBXsZZPxTuEqT9DRVfxFmIINIvquRdnNSd2Hk0XsZ_SyRVuVxYrjbpE?purpose=fullsize';

const DEFAULT_SERVICES = [
    {
        serviceId: 'cleaning',
        name: 'Home Cleaning',
        icon: '\u{1F9F9}',
        description: 'Professional deep-clean for your home, office, or apartment.',
        priceFrom: 499,
        category: 'Home',
        backgroundImage: 'https://cdn.mos.cms.futurecdn.net/CRSQiBvET2uwKdQK97E4Ad.jpg',
        reviewCriteria: ['Cleanliness', 'Timeliness', 'Professionalism'],
        isCustom: false,
    },
    {
        serviceId: 'plumbing',
        name: 'Plumbing',
        icon: '\u{1F527}',
        description: 'Leak repairs, pipe installation, and full plumbing services.',
        priceFrom: 299,
        category: 'Home',
        backgroundImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQil4s8KJptLyqlk4j-mmB5-jYLHM89sIiBfrtHL_LKOQ&s',
        reviewCriteria: ['Workmanship', 'Timeliness', 'Value for Money'],
        isCustom: false,
    },
    {
        serviceId: 'carpentry',
        name: 'Carpentry',
        icon: '\u{1FAB5}',
        description: 'Custom furniture, repairs, and all woodwork solutions.',
        priceFrom: 599,
        category: 'Home',
        backgroundImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAvAQaQhvw1em5iqpxRaTUIkCqehIYHamKog&s',
        reviewCriteria: ['Workmanship', 'Quality', 'Timeliness'],
        isCustom: false,
    },
    {
        serviceId: 'painting',
        name: 'Painting',
        icon: '\u{1F3A8}',
        description: 'Interior and exterior painting with premium-quality finishes.',
        priceFrom: 799,
        category: 'Home',
        backgroundImage: 'https://s3-blog.homelane.com/design-ideas-pre/wp-content/uploads/2022/11/slate-grey-wall-paint.jpg',
        reviewCriteria: ['Neatness', 'Quality', 'Timeliness'],
        isCustom: false,
    },
    {
        serviceId: 'electronics',
        name: 'Electronics Repair',
        icon: '\u{1F50C}',
        description: 'AC, TV, washing machine, and all home appliance repairs.',
        priceFrom: 199,
        category: 'Tech',
        backgroundImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6BmZt5eHe96kw5MQR7gKpcNHqHHd9MlsZMQ&s',
        reviewCriteria: ['Quality', 'Speed', 'Value for Money'],
        isCustom: false,
    },
    {
        serviceId: 'tutoring',
        name: 'Tutoring',
        icon: '\u{1F4DA}',
        description: 'One-on-one tutoring for school, college, and entrance exams.',
        priceFrom: 399,
        category: 'Education',
        backgroundImage: 'https://images.rawpixel.com/image_800/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvNDQtay04My1jaGltLTg1MzUxNi5qcGc.jpg',
        reviewCriteria: ['Clarity', 'Patience', 'Knowledge'],
        isCustom: false,
    },
    {
        serviceId: 'design',
        name: 'Graphic Design',
        icon: '\u270F\uFE0F',
        description: 'Logos, branding, UI/UX, and all creative design tasks.',
        priceFrom: 999,
        category: 'Creative',
        backgroundImage: 'https://planbcreative.org/wp-content/uploads/2021/02/pexels-tranmautritam-326501-2-1024x682.jpg',
        reviewCriteria: ['Creativity', 'Quality', 'Communication'],
        isCustom: false,
    },
    {
        serviceId: 'moving',
        name: 'Moving & Shifting',
        icon: '\u{1F69A}',
        description: 'Safe packing, loading, transport, and unpacking service.',
        priceFrom: 1499,
        category: 'Logistics',
        backgroundImage: 'https://5.imimg.com/data5/BA/FY/QO/SELLER-94934398/furniture-shifting-service-500x500.jpg',
        reviewCriteria: ['Care', 'Timeliness', 'Professionalism'],
        isCustom: false,
    },
];

const DEFAULT_SERVICE_MAP = new Map(
    DEFAULT_SERVICES.map((service) => [service.serviceId, service]),
);

connectDB();

const ok = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const err = (res, message, status = 400) => res.status(status).json({ success: false, message });

const sanitizeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
});

const decodeAuthToken = (authorization = '') => {
    if (!authorization?.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(authorization.replace('Bearer ', ''), JWT_SECRET);
    } catch {
        return null;
    }
};

const verifyToken = (req, res, next) => {
    const h = req.headers.authorization;
    if (!h) return err(res, 'No token provided', 403);
    try {
        req.user = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
        next();
    } catch {
        return err(res, 'Unauthorized', 401);
    }
};

const verifyInternalToken = (req, res, next) => {
    const token = req.headers['x-internal-token'];
    if (token !== INTERNAL_SERVICE_TOKEN) return err(res, 'Forbidden', 403);
    next();
};

const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') return err(res, 'Forbidden', 403);
    next();
};

const slugify = (value = '') =>
    String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `service-${Date.now()}`;

const createCustomServiceId = (name = 'custom-service', userId = 'user') =>
    `${slugify(name)}-${String(userId).slice(-6)}-${Date.now().toString(36)}`;

const isDefaultServiceId = (serviceId = '') =>
    DEFAULT_SERVICE_MAP.has(String(serviceId).trim().toLowerCase());

const mergeDefaultService = (baseService, overrideService) => {
    const override = overrideService?.toObject ? overrideService.toObject() : overrideService;
    if (!override) return { ...baseService };

    return {
        ...baseService,
        ...override,
        serviceId: baseService.serviceId,
        isCustom: false,
        visibility: 'PUBLIC',
        ownerUserId: null,
        ownerUserName: null,
        ownerUserEmail: null,
    };
};

const findOrCreateEditableService = async (serviceId, userId) => {
    const normalizedServiceId = String(serviceId || '').trim().toLowerCase();
    let service = await Service.findOne({ serviceId: normalizedServiceId, isActive: true });

    if (service) return service;
    if (!isDefaultServiceId(normalizedServiceId)) return null;

    const defaultService = DEFAULT_SERVICE_MAP.get(normalizedServiceId);
    service = new Service({
        serviceId: normalizedServiceId,
        name: defaultService.name,
        icon: defaultService.icon,
        description: defaultService.description,
        priceFrom: defaultService.priceFrom,
        category: defaultService.category,
        backgroundImage: defaultService.backgroundImage,
        reviewCriteria: defaultService.reviewCriteria,
        isCustom: false,
        visibility: 'PUBLIC',
        createdBy: String(userId || 'admin'),
    });

    return service;
};

const sanitizeService = (service, options = {}) => {
    const { includeOwnerDetails = false } = options;
    const source = service.toObject ? service.toObject() : service;
    return {
        id: source.serviceId,
        name: source.name,
        icon: source.icon || '\u{1F6E0}\uFE0F',
        description: source.description,
        priceFrom: Number(source.priceFrom) || 0,
        category: source.category || 'General',
        backgroundImage: source.backgroundImage || DEFAULT_SERVICE_BACKGROUND,
        reviewCriteria: Array.isArray(source.reviewCriteria) && source.reviewCriteria.length
            ? source.reviewCriteria
            : ['Quality', 'Timeliness', 'Professionalism'],
        isCustom: source.isCustom !== false,
        visibility: source.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
        ownerUserId: source.ownerUserId || null,
        ownerUserName: includeOwnerDetails ? source.ownerUserName || null : null,
        ownerUserEmail: includeOwnerDetails ? source.ownerUserEmail || null : null,
        publishedAt: source.publishedAt || null,
        publishedBy: source.publishedBy || null,
        createdBy: source.createdBy || null,
    };
};

const parseReviewCriteria = (criteria) => {
    if (Array.isArray(criteria)) {
        return criteria.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(criteria || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const cleanupWallet = async (userId) => {
    if (typeof fetch !== 'function') return;

    try {
        await fetch(`${WALLET_URL}/wallet/${userId}`, { method: 'DELETE' });
    } catch (error) {
        console.error('[user-service] wallet cleanup failed:', error.message);
    }
};

// Register (public, USER/PROVIDER only)
app.post('/users/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let { role } = req.body;

        if (role) role = role.toUpperCase();
        if (!['USER', 'PROVIDER'].includes(role)) role = 'USER';

        if (!name || !email || !password)
            return err(res, 'name, email and password are required');
        if (await User.findOne({ email: email.toLowerCase() }))
            return err(res, 'Email already registered');

        const user = await new User({
            name,
            email,
            password: await bcrypt.hash(password, 10),
            role,
        }).save();

        if (typeof fetch === 'function') {
            fetch(`${WALLET_URL}/wallet/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user._id.toString() }),
            }).catch((e) => console.error('[user-service] wallet auto-create failed:', e.message));
        } else {
            console.warn('[user-service] wallet auto-create skipped: fetch is not available in this Node runtime');
        }

        ok(res, { message: 'Registered successfully', userId: user._id }, 201);
    } catch (e) {
        if (e.name === 'ValidationError') {
            const messages = Object.values(e.errors).map((val) => val.message);
            return err(res, messages.join(', '));
        }
        err(res, e.message);
    }
});

// Login
app.post('/users/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const ADMIN_EMAIL = 'admin@vaultrix.io';
        const ADMIN_PASSWORD = 'Admin@Vaultrix123!';
        if (email?.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            const token = jwt.sign({ id: 'admin', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1d' });
            return ok(res, {
                token,
                user: { id: 'admin', name: 'Vaultrix Admin', email: ADMIN_EMAIL, role: 'ADMIN' },
            });
        }

        const user = await User.findOne({ email: email?.toLowerCase() });
        if (!user || !(await bcrypt.compare(password, user.password)))
            return err(res, 'Invalid email or password', 401);
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        ok(res, { token, user: sanitizeUser(user) });
    } catch (e) {
        err(res, e.message, 500);
    }
});

// Internal user lookup for other services
app.get('/users/internal/:id', verifyInternalToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return err(res, 'User not found', 404);
        ok(res, { user: sanitizeUser(user) });
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.get('/users/services', async (req, res) => {
    try {
        const requester = decodeAuthToken(req.headers.authorization);
        const includeOwnerDetails = requester?.role === 'ADMIN';
        const serviceFilter = { isActive: true };

        if (requester?.role === 'ADMIN') {
            // Admin can inspect both public and private services.
        } else if (requester?.id) {
            serviceFilter.$or = [
                { visibility: 'PUBLIC' },
                { ownerUserId: String(requester.id) },
            ];
        } else {
            serviceFilter.visibility = 'PUBLIC';
        }

        const persistedServices = await Service.find(serviceFilter).sort({ createdAt: -1 });
        const defaultOverrides = new Map();
        const customServices = [];

        persistedServices.forEach((service) => {
            if (isDefaultServiceId(service.serviceId)) {
                defaultOverrides.set(service.serviceId, service);
                return;
            }
            customServices.push(service);
        });

        ok(res, {
            services: [
                ...DEFAULT_SERVICES.map((service) => sanitizeService(
                    mergeDefaultService(service, defaultOverrides.get(service.serviceId)),
                    { includeOwnerDetails },
                )),
                ...customServices.map((service) => sanitizeService(service, { includeOwnerDetails })),
            ],
        });
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.post('/users/services', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const serviceId = slugify(req.body.id || req.body.name);
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const priceFrom = Number(req.body.priceFrom);

        if (!name || !description || !priceFrom)
            return err(res, 'name, description and priceFrom are required');

        if (DEFAULT_SERVICES.some((service) => service.serviceId === serviceId) || await Service.findOne({ serviceId }))
            return err(res, 'A service with this ID already exists');

        const service = await Service.create({
            serviceId,
            name,
            icon: String(req.body.icon || '\u{1F6E0}\uFE0F').trim(),
            description,
            priceFrom,
            category: String(req.body.category || 'General').trim(),
            backgroundImage: String(req.body.backgroundImage || '').trim() || DEFAULT_SERVICE_BACKGROUND,
            reviewCriteria: parseReviewCriteria(req.body.reviewCriteria),
            isCustom: false,
            visibility: 'PUBLIC',
            createdBy: req.user.id,
        });

        ok(res, { service: sanitizeService(service) }, 201);
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.post('/users/services/custom', verifyToken, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const budget = Number(req.body.budget);

        if (!name || !description || !budget || budget <= 0)
            return err(res, 'name, description, and a valid budget are required');

        const service = await Service.create({
            serviceId: createCustomServiceId(name, req.user.id),
            name,
            icon: '\u2728',
            description,
            priceFrom: budget,
            category: 'Custom',
            backgroundImage: DEFAULT_SERVICE_BACKGROUND,
            reviewCriteria: ['Quality', 'Communication', 'Value for Money'],
            isCustom: true,
            visibility: 'PRIVATE',
            ownerUserId: String(req.user.id),
            ownerUserName: String(req.body.userName || '').trim(),
            ownerUserEmail: String(req.body.userEmail || '').trim().toLowerCase(),
            createdBy: String(req.user.id),
        });

        ok(res, { service: sanitizeService(service) }, 201);
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.patch('/users/services/:serviceId', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const serviceId = req.params.serviceId.toLowerCase();
        const service = await findOrCreateEditableService(serviceId, req.user.id);
        if (!service) return err(res, 'Service not found', 404);

        const updates = {};
        const updatableFields = ['name', 'icon', 'description', 'category', 'backgroundImage'];

        updatableFields.forEach((field) => {
            if (field in req.body) {
                updates[field] = String(req.body[field] || '').trim();
            }
        });

        if ('priceFrom' in req.body) {
            const nextPrice = Number(req.body.priceFrom);
            if (!nextPrice || nextPrice <= 0) return err(res, 'priceFrom must be greater than 0');
            updates.priceFrom = nextPrice;
        }

        if ('reviewCriteria' in req.body) {
            updates.reviewCriteria = parseReviewCriteria(req.body.reviewCriteria);
        }

        if ('visibility' in req.body) {
            updates.visibility = isDefaultServiceId(serviceId)
                ? 'PUBLIC'
                : req.body.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC';
        }

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== '') service[key] = value;
        });

        if (isDefaultServiceId(serviceId)) {
            service.isCustom = false;
            service.visibility = 'PUBLIC';
        }

        await service.save();
        ok(res, { service: sanitizeService(service) });
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.patch('/users/services/:serviceId/publish', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const serviceId = req.params.serviceId.toLowerCase();
        const service = await findOrCreateEditableService(serviceId, req.user.id);
        if (!service) return err(res, 'Service not found', 404);

        ['name', 'icon', 'description', 'category', 'backgroundImage'].forEach((field) => {
            if (field in req.body) {
                const nextValue = String(req.body[field] || '').trim();
                if (nextValue) service[field] = nextValue;
            }
        });

        if ('priceFrom' in req.body) {
            const nextPrice = Number(req.body.priceFrom);
            if (nextPrice > 0) service.priceFrom = nextPrice;
        }

        if ('reviewCriteria' in req.body) {
            const nextCriteria = parseReviewCriteria(req.body.reviewCriteria);
            if (nextCriteria.length) service.reviewCriteria = nextCriteria;
        }

        service.isCustom = isDefaultServiceId(serviceId) ? false : service.isCustom !== false;
        service.visibility = 'PUBLIC';
        service.publishedAt = new Date();
        service.publishedBy = String(req.user.id);

        await service.save();
        ok(res, { service: sanitizeService(service), message: 'Service published for everyone.' });
    } catch (e) {
        err(res, e.message, 500);
    }
});

// Profile shortcut
app.get('/users/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return err(res, 'User not found', 404);
        ok(res, { user: sanitizeUser(user) });
    } catch (e) {
        err(res, e.message, 500);
    }
});

// Public profile for the logged-in user or admin
app.get('/users/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && String(req.user.id) !== String(req.params.id))
            return err(res, 'Forbidden', 403);

        const user = await User.findById(req.params.id).select('-password');
        if (!user) return err(res, 'User not found', 404);
        ok(res, { user: sanitizeUser(user) });
    } catch (e) {
        err(res, e.message, 500);
    }
});

// Delete account
app.delete('/users/:id', verifyToken, async (req, res) => {
    try {
        if (req.params.id === 'admin' || req.user.id === 'admin')
            return err(res, 'The admin account cannot be deleted.', 403);
        if (req.user.role !== 'ADMIN' && String(req.user.id) !== String(req.params.id))
            return err(res, 'Forbidden', 403);

        const user = await User.findById(req.params.id);
        if (!user) return err(res, 'User not found', 404);

        await User.deleteOne({ _id: req.params.id });
        await cleanupWallet(req.params.id);

        ok(res, { message: 'Account deleted successfully.' });
    } catch (e) {
        err(res, e.message, 500);
    }
});

app.get('/health', (req, res) =>
    res.json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => console.log(`[user-service] running on port ${PORT}`));
