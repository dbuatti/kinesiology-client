import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-6">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-indigo-900 mb-4">
          Welcome to Your Practice
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Connect with your clients and manage sessions seamlessly
        </p>
        
        <div className="space-y-4">
          <Button 
            className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            onClick={() => navigate('/active-session')}
          >
            <Calendar className="w-5 h-5 mr-2" />
            View Today's Session
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full h-12 text-lg"
            onClick={() => navigate('/active-session')}
          >
            <Clock className="w-5 h-5 mr-2" />
            Check Appointments
          </Button>
        </div>

        <div className="mt-12">
          <MadeWithDyad />
        </div>
      </div>
    </div>
  );
};

export default Index;