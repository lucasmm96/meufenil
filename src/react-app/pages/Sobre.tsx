import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router-dom";
import { Heart, CheckCircle, Lightbulb, Info } from "lucide-react";
import Layout from "@/react-app/components/Layout";
import { useEffect } from "react";

export default function SobrePage() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Sobre o MeuFenil</h1>
          <p className="text-lg text-gray-600">Uma ferramenta criada com carinho para a comunidade PKU</p>
        </div>

        {/* História */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Minha História</h2>
          <div className="prose prose-lg max-w-none text-gray-700 space-y-4 text-left md:text-justify">
            <p>
              Olá! Meu nome é {" "}
              <a
                href="https://www.linkedin.com/in/lucas-martins-menezes/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                Lucas
              </a>
              {" "} e sou marido de uma paciente com fenilcetonúria. Antes de conhecê-la, 
              essa condição era completamente desconhecida para mim. A convivência me mostrou o quanto ainda 
              faltam recursos no Brasil para pacientes com PKU — como fórmulas mais palatáveis, acesso ao 
              Dicloridrato de Sapropterina {" ("}
              <a
                href="https://www.biomarin.com/pt-br/kuvan-pku/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                Kuvan®
              </a>{"), "} produtos de baixa proteína e, principalmente, informações 
              nutricionais claras sobre a quantidade de fenilalanina nos alimentos.
            </p>
            <p>
              Manter uma dieta tão restritiva, com pouca informação disponível, é um grande desafio. Por 
              isso, decidi unir meu conhecimento em tecnologia à vontade de melhorar a rotina da minha 
              esposa e de outras pessoas na mesma condição.
            </p>
            <p>
              Este aplicativo foi criado para ajudar no controle diário da ingestão de alimentos e da{" "}
              fenilalanina. Os dados iniciais têm como base tabelas públicas disponibilizadas pela{" "}
              <a
                href="https://app.powerbi.com/view?r=eyJrIjoiODNlZDRiZWUtOTM3Ni00ZTBmLTgxYWUtNWUzM2ZkNTk5NTUyIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800"
              >
                ANVISA
              </a>
              , e o usuário também pode cadastrar seus próprios alimentos caso não os encontre na lista.
            </p>

            <p className="font-semibold text-indigo-600">
              Este é um projeto totalmente sem fins lucrativos, com o único objetivo de contribuir — mesmo 
              que um pouco — para uma melhor qualidade de vida das pessoas com fenilcetonúria.
            </p>
          </div>
        </div>

        {/* Como usar */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Como Usar o App</h2>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Configure seu Perfil</h3>
                <p className="text-gray-600">
                  Acesse a página "Perfil" e defina seu limite diário de fenilalanina em miligramas 
                  conforme orientação do seu nutricionista ou médico.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Registre suas Refeições</h3>
                <p className="text-gray-600">
                  No Dashboard, clique em "Adicionar Registro". Busque o alimento, informe o peso 
                  consumido e veja automaticamente a quantidade de fenilalanina calculada.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Crie Alimentos Personalizados</h3>
                <p className="text-gray-600">
                  Não encontrou um alimento? Clique em "Criar Novo Alimento" para adicionar suas 
                  próprias referências com os valores nutricionais corretos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">4</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Acompanhe suas Estatísticas</h3>
                <p className="text-gray-600">
                  Visualize gráficos e relatórios do seu consumo ao longo do tempo. Use a página 
                  "Estatísticas" para analisar padrões e ajustar sua dieta.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">5</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Registre seus Exames</h3>
                <p className="text-gray-600">
                  Na página "Exames PKU", registre os resultados dos seus exames de fenilcetonúria 
                  em mg/dL e acompanhe a evolução ao longo do tempo.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">6</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Exporte seus Dados</h3>
                <p className="text-gray-600">
                  No seu perfil, você pode exportar todos os seus dados em CSV ou JSON para 
                  compartilhar com profissionais de saúde ou fazer backup.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recursos */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Principais Recursos</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Banco de Alimentos</h4>
                <p className="text-sm text-gray-600">Mais de 1000 alimentos com valores da ANVISA</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Cálculo Automático</h4>
                <p className="text-sm text-gray-600">Fenilalanina calculada instantaneamente</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-pink-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Histórico Completo</h4>
                <p className="text-sm text-gray-600">Acesse todo seu histórico de consumo</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Gráficos e Estatísticas</h4>
                <p className="text-sm text-gray-600">Visualize tendências e padrões</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Controle de Exames</h4>
                <p className="text-sm text-gray-600">Registre e acompanhe seus exames PKU</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Exportação de Dados</h4>
                <p className="text-sm text-gray-600">CSV e JSON para seus registros</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">Conformidade LGPD</h4>
                <p className="text-sm text-gray-600">Seus dados seguros e privados</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-teal-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-gray-900">PWA / Mobile</h4>
                <p className="text-sm text-gray-600">Funciona como app no celular</p>
              </div>
            </div>
          </div>
        </div>

        {/* Aviso */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-2">Aviso Importante</h3>
              <p className="text-sm text-yellow-800">
                Este aplicativo é uma ferramenta de auxílio no controle da fenilcetonúria. 
                Ele não substitui o acompanhamento médico e nutricional profissional. 
                Sempre consulte seu médico e nutricionista para orientações sobre sua dieta 
                e tratamento. Os valores nutricionais são baseados em tabelas públicas e 
                podem variar entre marcas e preparos.
              </p>
            </div>
          </div>
        </div>

        {/* Agradecimento */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 text-center text-white shadow-lg">
          <Heart className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <h3 className="text-2xl font-bold mb-2">Obrigado por usar o MeuFenil!</h3>
          <p className="text-indigo-100">
            Juntos, podemos tornar o controle da PKU mais simples e acessível para todos.
          </p>
        </div>
      </div>
    </Layout>
  );
}
