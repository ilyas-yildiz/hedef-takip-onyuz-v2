import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';

export default function Dashboard() {
    const [projects, setProjects] = useState([]);
    const [newProjectTitle, setNewProjectTitle] = useState('');
    const [token] = useState(localStorage.getItem('api_token'));

    // YENİ: Plan oluşturulurken beklediğimizi belirten state
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();

    const fetchProjects = () => {
        if (!token) return;
        fetch('http://localhost/api/v1/projects', {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => setProjects(data));
    };

    useEffect(() => {
        fetchProjects();
    }, [token]);

    const handleCreatePlan = (e) => {
        e.preventDefault();
        setIsCreating(true); // Yükleniyor durumunu başlat
        setError(''); // Eski hataları temizle

        fetch('http://localhost/api/v1/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: newProjectTitle }),
        })
            .then(res => {
                if (!res.ok) {
                    // Hata varsa, cevabı JSON olarak okuyup hatayı fırlat
                    return res.json().then(err => { throw err; });
                }
                return res.json();
            })
            .then(() => {
                setNewProjectTitle('');
                fetchProjects(); // Listeyi yenile
            })
            .catch(err => {
                // Hata yakalanırsa, kullanıcıya göster
                console.error("Plan oluşturma hatası:", err);
                setError('Plan oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
            })
            .finally(() => {
                setIsCreating(false); // İşlem bitince (başarılı veya hatalı) yükleniyor durumunu bitir
            });
    };

    const handleLogout = () => {
        localStorage.removeItem('api_token');
        navigate(0); // Sayfayı yenileyerek login ekranına dön
    };

    return (
        <div className="container mt-5">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Projelerim</h1>
                <button onClick={handleLogout} className="btn btn-outline-secondary">Çıkış Yap</button>
            </div>

            <div className="card p-4">
                <div className="project-list mb-4">
                    <h5>Mevcut Projeler</h5>
                    {projects.length > 0 ? (
                        <div className="list-group">
                            {projects.map(project => (
                                <Link to={`/project/${project.id}`} key={project.id} className="list-group-item list-group-item-action">
                                    {project.title}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        !isCreating && <div className="alert alert-info">
                            Henüz bir proje oluşturmadınız. Aşağıdaki formu kullanarak ilk projenizi başlatın!
                        </div>
                    )}
                </div>

                <hr />

                <form onSubmit={handleCreatePlan} className="mt-4">
                    <h5 className="mb-3">Yeni Proje Oluştur</h5>
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            value={newProjectTitle}
                            onChange={(e) => setNewProjectTitle(e.target.value)}
                            placeholder="Yeni 5 yıllık proje başlığı..."
                            required
                            disabled={isCreating} // Yüklenirken input'u pasif yap
                        />
                        <button type="submit" className="btn btn-primary" disabled={isCreating}>
                            {/* Yüklenirken butonun yazısını ve durumunu değiştir */}
                            {isCreating ? 'Oluşturuluyor...' : 'Oluştur ve Planı Başlat'}
                        </button>
                    </div>
                    {error && <p className="text-danger mt-2">{error}</p>}
                </form>
            </div>
        </div>
    );
}